#include <assert.h>
#include <ctype.h>
#include <dirent.h>
#include <errno.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <threads.h>
#include <unistd.h>
#include "c2m.h"
#include "logic.h"
#include "stdbool.h"

typedef enum Outcome {
  OUTCOME_SUCCESS = 0,
  OUTCOME_BADINPUT = 1,
  OUTCOME_NOINPUT = 2,
  OUTCOME_ERROR = 3
} Outcome;

const char* outcome_names[] = {"success", "badInput", "noInput", "error"};
#define RED_ESCAPE "\x1b[31m"
#define GREEN_ESCAPE "\x1b[92m"
#define CYAN_ESCAPE "\x1b[36m"
#define RESET_ESCAPE "\x1b[0m"
#define CLEAR_LINES_ESCAPE(n) "\x1b[" #n "F\x1b[2K"

typedef struct SyncfileEntry {
  char* level_name;
  Outcome expected_outcome;
  Vector_Glitch expected_glitches;
} SyncfileEntry;

typedef struct Syncfile {
  SyncfileEntry default_entry;
  SyncfileEntry* entries;
  size_t entries_len;
} Syncfile;

const SyncfileEntry* Syncfile_get_entry(const Syncfile* self,
                                        const char* level_name) {
  for (size_t idx = 0; idx < self->entries_len; idx += 1) {
    if (!strcmp(level_name, self->entries[idx].level_name))
      return &self->entries[idx];
  }
  return &self->default_entry;
}

void Syncfile_free(Syncfile* self) {
  free(self->default_entry.level_name);
  for (size_t idx = 0; idx < self->entries_len; idx += 1) {
    free(self->entries[idx].level_name);
    Vector_Glitch_uninit(&self->entries[idx].expected_glitches);
  }
  free(self->entries);
  free(self);
}

char* ranged_str_copy(const char* start, const char* end) {
  char* str = xmalloc(end - start + 1);
  memcpy(str, start, end - start);
  str[end - start] = 0;
  return str;
}

int match_outcome_str(const char* str) {
  if (!strcmp(str, "success"))
    return OUTCOME_SUCCESS;
  if (!strcmp(str, "badInput"))
    return OUTCOME_BADINPUT;
  if (!strcmp(str, "noInput"))
    return OUTCOME_NOINPUT;
  if (!strcmp(str, "error"))
    return OUTCOME_ERROR;
  return -1;
}

typedef Syncfile* SyncfilePtr;
DEFINE_RESULT(SyncfilePtr);

DEFINE_RESULT(Glitch);

typedef struct GlitchKindNameEnt {
  const char* key;
  GlitchKind val;
} GlitchKindNameEnt;

static const GlitchKindNameEnt glitch_kind_names[] = {
    {"DESPAWN", GLITCH_TYPE_DESPAWN},
    {"SIMULTANEOUS_CHARACTER_MOVEMENT",
     GLITCH_TYPE_SIMULTANEOUS_CHARACTER_MOVEMENT},
    {"DYNAMITE_EXPLOSION_SNEAKING", GLITCH_TYPE_DYNAMITE_EXPLOSION_SNEAKING},
    {"DROP_BY_DESPAWNED", GLITCH_TYPE_DROP_BY_DESPAWNED},
    {"BLUE_TELEPORT_INFINITE_LOOP", GLITCH_TYPE_BLUE_TELEPORT_INFINITE_LOOP}};

Result_Glitch parse_glitch_str(const char* str) {
  Result_Glitch res;
  Glitch glitch = {};
  int x;
  int y;
  char glitch_kind_str[51];
  char glitch_specifier_str[51];
  int scanf_ret = sscanf(str, " (%d, %d) %50s %50s", &x, &y, glitch_kind_str,
                         glitch_specifier_str);
  if (scanf_ret < 3)
    res_throws("Failed to read glitch string");
  glitch.location = (Position){x, y};
  for (size_t idx = 0; idx < lengthof(glitch_kind_names); idx += 1) {
    GlitchKindNameEnt ent = glitch_kind_names[idx];
    if (!strcmp(glitch_kind_str, ent.key)) {
      glitch.glitch_kind = ent.val;
      break;
    }
  }
  if (glitch.glitch_kind == GLITCH_TYPE_INVALID)
    res_throwf("Unknown glitch type \"%s\"", glitch_kind_str);
  if (glitch.glitch_kind == GLITCH_TYPE_DESPAWN) {
    if (scanf_ret != 4)
      res_throws("Despawn glitches need a specifier");
    if (!strcmp(glitch_specifier_str, "replace"))
      glitch.specifier = GLITCH_SPECIFIER_DESPAWN_REPLACE;
    else if (!strcmp(glitch_specifier_str, "delete"))
      glitch.specifier = GLITCH_SPECIFIER_DESPAWN_REMOVE;
    else
      res_throws("Invalid despawn specifier");
  }

  res_return(glitch);
}

Result_SyncfilePtr Syncfile_parse(const char* str) {
  // A somewhat hacky ini parser. Should be fine?
  Syncfile* sync = xmalloc(sizeof(Syncfile));
  const char* str_start = str;
#define str_pos (size_t)(str - str_start)
  *sync = (Syncfile){
      .default_entry = (SyncfileEntry){.level_name = NULL,
                                       .expected_outcome = OUTCOME_SUCCESS},
      .entries = NULL,
      .entries_len = 0};
  Result_SyncfilePtr res;
#define skip_str_while(expr, fail_on_null)  \
  while ((expr) && *str != '\0')            \
    str += 1;                               \
  if (*str == '\0') {                       \
    if (fail_on_null) {                     \
      Syncfile_free(sync);                  \
      res_throws("Unexpected end of file"); \
    } else {                                \
      res_return(sync);                     \
    }                                       \
  }
  const char* capture_start;
  char* capture_res;
  // ""inline"" function to extract a string between the cursor and first
  // character to not match `expr`
#define capture_str_while(expr) \
  capture_start = str;          \
  skip_str_while(expr, true);   \
  capture_res = ranged_str_copy(capture_start, str);

  SyncfileEntry* current_entry = NULL;
  while (*str != '\0') {
    if (*str == '[') {
      // Header
      str += 1;
      capture_str_while(*str != ']');
      if (!strcmp(capture_res, "_default")) {
        current_entry = &sync->default_entry;
        free(capture_res);
      } else {
        sync->entries_len += 1;
        sync->entries =
            xrealloc(sync->entries, sync->entries_len * sizeof(SyncfileEntry));
        current_entry = &sync->entries[sync->entries_len - 1];
        *current_entry = (SyncfileEntry){
            .level_name = capture_res,
            .expected_outcome = OUTCOME_SUCCESS,
        };
      }
      skip_str_while(*str != '\n', false);
    } else if (isalnum(*str)) {
      // Key-val
      capture_str_while(isalnum(*str));
      char* key = capture_res;
      bool is_array = false;
      if (str[0] == '[' && str[1] == ']') {
        is_array = true;
        str += 2;
      }
      skip_str_while(isblank(*str), true);
      if (*str != '=') {
        Syncfile_free(sync);
        res_throwf("char %zd: Expected = after key", str_pos);
      }
      str += 1;
      skip_str_while(isblank(*str), true);
      // NOTE: This will throw with "Unexpected end of file" if there's a null
      // here, but it *should* be fine. Don't wanna copy `capture_str_while`
      // with no null check here (or add an arg to it), so whatever
      capture_str_while(*str != '\n');
      char* val = capture_res;
      if (!strcmp(key, "outcome")) {
        free(key);
        int outcome = match_outcome_str(val);
        if (outcome == -1) {
          Syncfile_free(sync);
          char* err = stringf("Invalid outcome string \"%s\"", val);
          free(val);
          res_throwr(err);
        }
        free(val);
        current_entry->expected_outcome = outcome;
      } else if (!strcmp(key, "glitches")) {
        free(key);
        Result_Glitch glitch_res = parse_glitch_str(val);
        if (!glitch_res.success) {
          Syncfile_free(sync);
          char* err = stringf("Invalid glitch string \"%s\" - %s", val,
                              glitch_res.error);
          free(val);
          free(glitch_res.error);
          res_throwr(err);
        }
        Vector_Glitch_push(&current_entry->expected_glitches, glitch_res.value);
        free(val);
      } else {
        free(val);
        char* err = stringf("Unexpected key \"%s\"", key);
        free(key);
        Syncfile_free(sync);
        res_throwr(err);
      }

    } else if (*str == '#') {
      // Comment
      skip_str_while(*str != '\n', false);
    } else {
      str += 1;
    }
  }
  res_return(sync);
#undef skip_str_while
#undef capture_str_while
}

typedef struct Buffer {
  void* data;
  size_t length;
} Buffer;
DEFINE_RESULT(Buffer);

Result_Buffer Buffer_read_file(const char* path) {
  Result_Buffer res;
  FILE* file = fopen(path, "rb");
  if (!file) {
    res_throwe("Failed to open %s", path);
  }
  fseek(file, 0, SEEK_END);
  long file_len = ftell(file);
  fseek(file, 0, SEEK_SET);
  void* buf = xmalloc(file_len);
  fread(buf, 1, file_len, file);
  fclose(file);
  res.value = (Buffer){.data = buf, .length = file_len};
  res_return(res.value);
}

void Level_verify(Level* self) {
  PlayerSeat* seat = &self->player_seats.items[0];
  Replay* replay = self->builtin_replay;
  self->rng_blob = replay->rng_blob;
  self->rff_direction = replay->rff_direction;
  if (!replay)
    return;
  uint16_t bonus_ticks = 60 * 20;
  Level_tick(self);
  Level_tick(self);
  while (self->game_state == GAMESTATE_PLAYING && bonus_ticks > 0) {
    if (self->current_tick >= replay->inputs.length) {
      bonus_ticks -= 1;
      seat->inputs = replay->inputs.items[replay->inputs.length - 1];
    } else {
      seat->inputs = replay->inputs.items[self->current_tick];
    }
    Level_tick(self);
   	Level_tick(self);
   	Level_tick(self);
  }
}

Result_SyncfilePtr get_syncfile(const char* path) {
  Syncfile* syncfile;
  Result_SyncfilePtr res;
  if (path) {
    Result_Buffer res_buf = Buffer_read_file(path);
    if (!res_buf.success) {
      res_throwr(res_buf.error);
    };
    char* str_buf = xmalloc(res_buf.value.length + 1);
    memcpy(str_buf, res_buf.value.data, res_buf.value.length);
    str_buf[res_buf.value.length] = 0;
    free(res_buf.value.data);

    res = Syncfile_parse(str_buf);
    free(str_buf);
    return res;
  } else {
    // A basic default syncfile
    syncfile = xmalloc(sizeof(Syncfile));
    syncfile->default_entry = (SyncfileEntry){
        .level_name = NULL, .expected_outcome = OUTCOME_SUCCESS};
    syncfile->entries = NULL;
    syncfile->entries_len = 0;
    res_return(syncfile);
  }
}

typedef struct FileList {
  size_t files_n;
  char** files;
} FileList;
DEFINE_RESULT(FileList);

void FileList_push(FileList* self, char* file) {
  self->files_n += 1;
  self->files = xrealloc(self->files, self->files_n * sizeof(FileList));
  self->files[self->files_n - 1] = file;
}
void FileList_append(FileList* self, FileList* other) {
  for (size_t idx = 0; idx < other->files_n; idx += 1) {
    FileList_push(self, other->files[idx]);
  }
}
void FileList_free(FileList* self) {
  for (size_t idx = 0; idx < self->files_n; idx += 1) {
    free(self->files[idx]);
  }
  free(self->files);
}

char* join_path(const char* a, const char* b) {
  size_t a_len = strlen(a);
  size_t b_len = strlen(b);
  size_t name_len = a_len + 1 + b_len + 1;
  char* ab = xmalloc(name_len);
  memcpy(ab, a, a_len);
  ab[a_len] = '/';
  memcpy(ab + a_len + 1, b, b_len + 1);
  return ab;
}

Result_FileList expand_file_list(FileList input) {
  Result_FileList res;
#define list res.value
  list.files = NULL;
  list.files_n = 0;

  struct stat stat_res;
  for (size_t idx = 0; idx < input.files_n; idx += 1) {
    const char* file = input.files[idx];
    int err = stat(file, &stat_res);
    if (err) {
      FileList_free(&list);
      res_throwe("Failed to stat %s", file);
    }
    if (S_ISREG(stat_res.st_mode)) {
      size_t file_len = strlen(file);
      if (!strcasecmp(&file[file_len - 4], ".c2m")) {
        FileList_push(&list, strdupz(file));
      }
    } else if (S_ISDIR(stat_res.st_mode)) {
      DIR* dir = opendir(file);
      struct dirent* ent;
      while ((ent = readdir(dir)) != NULL) {
        if (!strcmp(ent->d_name, ".") || !strcmp(ent->d_name, ".."))
          continue;
        char* name = join_path(file, ent->d_name);
        Result_FileList res2 =
            expand_file_list((FileList){.files = &name, .files_n = 1});
        free(name);
        if (!res2.success) {
          closedir(dir);
          FileList_free(&list);
          res_throwr(res2.error);
        }
        FileList_append(&list, &res2.value);
        free(res2.value.files);
      }
      closedir(dir);
    } else {
      FileList_free(&list);
      res_throws("Encountered weird file type");
    }
  }
  res_return(list);
#undef list
};

typedef struct OutcomeReport {
  char* title;
  Outcome outcome;
  char* error_desc;
  Vector_Glitch glitches;
} OutcomeReport;

typedef struct ThreadGlobals {
  FileList* file_list;
  mtx_t* levels_left_mtx;
  size_t* levels_left;
  OutcomeReport* outcome_report;
  bool* outcome_report_set;
  mtx_t* outcome_report_mtx;
  cnd_t* outcome_report_nonempty_cnd;
  cnd_t* outcome_report_nonfull_cnd;
} ThreadGlobals;

OutcomeReport verify_level(const char* file_path) {
  OutcomeReport report = {.error_desc = NULL, .title = NULL};
  Result_Buffer res1 = Buffer_read_file(file_path);
  if (!res1.success) {
    report.outcome = OUTCOME_ERROR;
    report.error_desc = res1.error;
    return report;
  }
  Result_LevelPtr res2 = parse_c2m(res1.value.data, res1.value.length);
  if (!res2.success) {
    // Try to parse metadata-only for the level name
    Result_LevelMetadataPtr res3 =
        parse_c2m_meta(res1.value.data, res1.value.length);
    free(res1.value.data);
    if (res3.success) {
      report.title = strdupz(res3.value->title);
      LevelMetadata_uninit(res3.value);
      free(res3.value);
    } else {
      // Use the original error
      free(res3.error);
    }
    report.outcome = OUTCOME_ERROR;
    report.error_desc = res2.error;
    return report;
  }
  free(res1.value.data);
  Level* level = res2.value;
  report.title = strdupz(level->metadata.title);
  if (!level->builtin_replay) {
    report.outcome = OUTCOME_ERROR;
    report.error_desc = strdupz("No built-in replay");
    Level_uninit(level);
    free(level);
    return report;
  }
  Level_verify(level);
  report.glitches = Vector_Glitch_clone(&level->glitches);
  if (level->game_state == GAMESTATE_WON) {
    report.outcome = OUTCOME_SUCCESS;
  } else if (level->game_state == GAMESTATE_PLAYING) {
    report.outcome = OUTCOME_NOINPUT;
  } else {
    report.outcome = OUTCOME_BADINPUT;
  }
  Level_uninit(level);
  free(level);
  return report;
}

bool glitch_vectors_equal(const Vector_Glitch* restrict left,
                          const Vector_Glitch* restrict right) {
  if (left->length != right->length)
    return false;
  for (size_t idx = 0; idx < left->length; idx += 1) {
    Glitch* restrict left_g = &left->items[idx];
    Glitch* restrict right_g = &right->items[idx];
    if (left_g->glitch_kind != right_g->glitch_kind)
      return false;
    // Ignore `happens_at`, since it isn't specified in syncfiles
    if (left_g->location.x != right_g->location.x ||
        left_g->location.y != right_g->location.y)
      return false;
    if (left_g->specifier != right_g->specifier)
      return false;
  }
  return true;
}

int level_thread(void* globals_v) {
  ThreadGlobals* globals = globals_v;
  while (true) {
    // Acquire next level file to verify
    mtx_lock(globals->levels_left_mtx);
    if (*globals->levels_left == 0) {
      mtx_unlock(globals->levels_left_mtx);
      break;
    }
    size_t file_idx = *globals->levels_left - 1;
    *globals->levels_left -= 1;
    char* level_file = globals->file_list->files[file_idx];
    globals->file_list->files[file_idx] = NULL;
    mtx_unlock(globals->levels_left_mtx);
    // printf("%s working\n", level_file);
    OutcomeReport report = verify_level(level_file);
    // printf("%s done\n", level_file);
    free(level_file);
    // Submit the result
    mtx_lock(globals->outcome_report_mtx);
    while (*globals->outcome_report_set) {
      cnd_wait(globals->outcome_report_nonfull_cnd,
               globals->outcome_report_mtx);
    }
    assert(*globals->outcome_report_set == false);
    *globals->outcome_report = report;
    *globals->outcome_report_set = true;
    cnd_signal(globals->outcome_report_nonempty_cnd);
    mtx_unlock(globals->outcome_report_mtx);
  }
  return 0;
}

#define MAX_THREADS_N 16

const char* const help_message =
    "notcc-cli - verify Chip's Challenge 2 level solutions\n"
    "USAGE: notcc-cli [-vh] [-s syncfile.sync] [-j <max_threads>] [files or "
    "dirs ...]\n\n"
    "Given list of files and directories is recursively expanded and filtered "
    "for files ending in the C2M extension. By default, the built-in level "
    "replays are verified.\n\n"
    "A syncfile, if supplied, specifies the expected outcome for each "
    "solution. See the NotCC syncfiles directory for examples. By default, all "
    "levels are expected to succeed with no non-legal glitches.\n";

void complain_about_wrong_outcome(const OutcomeReport* report,
                                  Outcome expected_outcome) {
  char* outcome_str;
  if (report->outcome == OUTCOME_ERROR) {
    assert(report->error_desc != NULL);
    outcome_str =
        stringf("%s (%s)", outcome_names[report->outcome], report->error_desc);
    free(report->error_desc);
  } else {
    assert(report->error_desc == NULL);
    // We don't ever modify this if `report.outcome != OUTCOME_ERROR`, so
    // discarding `const` is fine here
    outcome_str = (char*)outcome_names[report->outcome];
  }
  printf(RED_ESCAPE "%s - expected outcome %s, got %s\n" RESET_ESCAPE,
         report->title, outcome_names[expected_outcome], outcome_str);
  if (report->outcome == OUTCOME_ERROR) {
    free(outcome_str);
  }
}

char* make_glitch_str(const Vector_Glitch* glitches) {
  char* str = strdup("[");
  for_vector(Glitch*, glitch, glitches) {
    const char* glitch_name = NULL;

    for (size_t idx = 0; idx < lengthof(glitch_kind_names); idx += 1) {
      GlitchKindNameEnt ent = glitch_kind_names[idx];
      if (glitch->glitch_kind == ent.val) {
        glitch_name = ent.key;
        break;
      }
    }
    if (glitch_name == NULL)
      glitch_name = "UNKNOWN_GLITCH_TYPE";

    const char* glitch_specifier = "";
    if (glitch->glitch_kind == GLITCH_TYPE_DESPAWN) {
      if (glitch->specifier == GLITCH_SPECIFIER_DESPAWN_REPLACE)
        glitch_specifier = " replace";
      else if (glitch->specifier == GLITCH_SPECIFIER_DESPAWN_REMOVE)
        glitch_specifier = " delete";
    }

    char* glitch_str =
        stringf("(%d, %d) %s%s, ", glitch->location.x, glitch->location.y,
                glitch_name, glitch_specifier);
    str = realloc(str, strlen(str) + strlen(glitch_str) + 1);
    strcat(str, glitch_str);
    free(glitch_str);
  }
  str = realloc(str, strlen(str) + 2);
  strcat(str, "]");
  return str;
}
void complain_about_wrong_glitches(const OutcomeReport* report,
                                   const Vector_Glitch* expected_glitches) {
  char* expected_glitches_str = make_glitch_str(expected_glitches);
  char* got_glitches_str = make_glitch_str(&report->glitches);
  printf(RED_ESCAPE "%s - expected glitches %s, got %s\n" RESET_ESCAPE,
         report->title, expected_glitches_str, got_glitches_str);
  free(expected_glitches_str);
  free(got_glitches_str);
}

int main(int argc, char* argv[]) {
  // argc = 2;
  // argv = (char*[]){"", "/home/glander/wired tp recorded.c2m"};
#define error_and_exit(msg_alloc, msg) \
  do {                                 \
    fprintf(stderr, "%s\n", msg);      \
    if (msg_alloc)                     \
      free(msg);                       \
    return 1;                          \
  } while (false);
  int opt;
  bool verbose = false;
  char* syncfile_path = NULL;
  size_t max_threads = MAX_THREADS_N;
  while ((opt = getopt(argc, argv, "vhs:j:")) != -1) {
    switch (opt) {
      case 'h':
        fputs(help_message, stdout);
        free(syncfile_path);
        return 0;
      case 'v':
        verbose = true;
        break;
      case 's':
        syncfile_path = strdupz(optarg);
        break;
      case 'j':
        max_threads = atol(optarg);
        break;
      default:
        free(syncfile_path);
        return 1;
        break;
    }
  }
  if (optind >= argc) {
    free(syncfile_path);
    fputs(help_message, stderr);
    error_and_exit(false, "Must supply at least one positional argument");
  }
  // Get filelist
  size_t files_buf_size = (argc - optind) * sizeof(char*);
  char** files = xmalloc(files_buf_size);
  memcpy(files, &argv[optind], files_buf_size);
  FileList initial_list = {.files = files, .files_n = (argc - optind)};
  Result_FileList res1 = expand_file_list(initial_list);
  free(files);
  if (!res1.success) {
    free(syncfile_path);
    error_and_exit(true, res1.error);
  }
  FileList list = res1.value;
  if (list.files_n == 0) {
    free(syncfile_path);
    FileList_free(&list);
    error_and_exit(false, "No C2M files supplied");
  }
  // for (size_t idx = 0; idx < list.files_n; idx += 1) {
  //   puts(list.files[idx]);
  // }

  // Get syncfile
  Result_SyncfilePtr res2 = get_syncfile(syncfile_path);
  free(syncfile_path);
  if (!res2.success) {
    FileList_free(&list);
    error_and_exit(true, res2.error);
  }
  Syncfile* syncfile = res2.value;
  size_t levels_left = list.files_n;
  mtx_t levels_left_mtx;
  mtx_init(&levels_left_mtx, mtx_plain);
  mtx_t outcome_report_mtx;
  mtx_init(&outcome_report_mtx, mtx_plain);
  cnd_t outcome_report_nonempty_cnd;
  cnd_init(&outcome_report_nonempty_cnd);
  cnd_t outcome_report_nonfull_cnd;
  cnd_init(&outcome_report_nonfull_cnd);
  OutcomeReport shared_report;
  bool shared_report_set = false;
  ThreadGlobals globals = {
      .file_list = &list,
      .levels_left = &levels_left,
      .levels_left_mtx = &levels_left_mtx,
      .outcome_report = &shared_report,
      .outcome_report_set = &shared_report_set,
      .outcome_report_mtx = &outcome_report_mtx,
      .outcome_report_nonempty_cnd = &outcome_report_nonempty_cnd,
      .outcome_report_nonfull_cnd = &outcome_report_nonfull_cnd};
  size_t thread_count = list.files_n > max_threads ? max_threads : list.files_n;
  thrd_t* threads = xmalloc(sizeof(thrd_t) * thread_count);
  memset(threads, 0, sizeof(thrd_t) * thread_count);
  for (size_t idx = 0; idx < thread_count; idx += 1) {
    thrd_create(&threads[idx], level_thread, &globals);
  }
  size_t levels_passed = 0;
  size_t levels_failed = 0;
  size_t levels_verified_total = 0;
#define print_stats()                                                     \
  printf(GREEN_ESCAPE "Pass: %zd (%.1f%%)\n" RESET_ESCAPE, levels_passed, \
         levels_passed * 100. / levels_verified_total);                   \
  printf(RED_ESCAPE "Fail: %zd (%.1f%%)\n" RESET_ESCAPE, levels_failed,   \
         levels_failed * 100. / levels_verified_total);                   \
  printf(CYAN_ESCAPE "Verified: %zd\n" RESET_ESCAPE, levels_verified_total);

  while (true) {
    mtx_lock(&outcome_report_mtx);
    while (!shared_report_set) {
      cnd_wait(&outcome_report_nonempty_cnd, &outcome_report_mtx);
    }
    // Copy the report so that it can be analyzed without locking the report
    // mutex for the whole check
    OutcomeReport report = shared_report;
    shared_report_set = false;
    cnd_signal(&outcome_report_nonfull_cnd);
    mtx_unlock(&outcome_report_mtx);
    levels_verified_total += 1;
    if (report.outcome == OUTCOME_ERROR && report.title == NULL) {
      assert(report.error_desc != NULL);
      printf(RED_ESCAPE "Reading error: %s\n" RESET_ESCAPE, report.error_desc);
      free(report.error_desc);
      levels_failed += 1;
    } else {
      const SyncfileEntry* entry = Syncfile_get_entry(syncfile, report.title);
      bool glitches_equal =
          glitch_vectors_equal(&report.glitches, &entry->expected_glitches);
      if (entry->expected_outcome != report.outcome || !glitches_equal) {
        levels_failed += 1;
        if (entry->expected_outcome != report.outcome) {
          complain_about_wrong_outcome(&report, entry->expected_outcome);
        }
        if (!glitches_equal) {
          complain_about_wrong_glitches(&report, &entry->expected_glitches);
        }
      } else {
        if (verbose) {
          printf(GREEN_ESCAPE "%s - %s\n" RESET_ESCAPE, report.title,
                 outcome_names[entry->expected_outcome]);
        }
        levels_passed += 1;
      }
      free(report.title);
      Vector_Glitch_uninit(&report.glitches);
    }
    print_stats();
    printf(CLEAR_LINES_ESCAPE(3));
    if (levels_verified_total == list.files_n) {
      break;
    }
  }
  for (size_t idx = 0; idx < thread_count; idx += 1) {
    thrd_join(threads[idx], NULL);
  }
  free(threads);
  print_stats();

  Syncfile_free(syncfile);
  FileList_free(&list);
  return levels_failed == 0 ? 0 : 1;
}
