#include "logic.h"
#include "misc.h"
typedef Level* LevelPtr;
typedef LevelMetadata* LevelMetadataPtr;
DEFINE_RESULT(LevelPtr);
DEFINE_RESULT(LevelMetadataPtr);

Result_LevelPtr parse_c2m(void* data, size_t data_len);
Result_LevelMetadataPtr parse_c2m_meta(void* data, size_t data_len);
