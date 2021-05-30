# NCCS

**NCCS** (extension being .ncss) is the file format used for storing
NotCC level scores and solutions, similar to the TWS file
format.

All data in the file is little-endian.

(This is not an actual spec, more of a wikipedia article, but whatever)

## Format

### Section header

The file is a binary file consisting of several sections one after the
other, terminated by the END section. Each section begins with a section
header, which is followed by the section's data.

| Bytes | Content                                                                                                                                                            |
|-------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 4     | Four character code identifying the section, see table below. Codes shorter than 4 characters (such as "END") are padded with spaces (making "END " in this case). |
| 4     | The length of the section's data                                                                                                                                   |

### Section types

| Section ID | Content Type             | Content                  |
|------------|--------------------------|--------------------------|
| NCCS       | Null-terminated string   | The file's version. The latest version is "0.2"  |
| FILE       | Null-terminated string   | The level's (or level set's) file name           |
| TYPE       | Null-terminated string   | Usually the name of the levelset. For the base CC2 set it's "Chips Challenge 2". If the level does not have a proper set name (eg. DATs, C2Ms outside of sets), is zero-length. |
| NAME       | Null-terminated string   | The level's title, zero-length if the level has no title. |
| PASS       | Null-terminated string   | The level's password, zero-length if the level has no password. |
| MISC       | 100 bytes                | Level miscellaneous data. The format is identical to the format of the SAVE section in C2H files. |
| SLN /PSLN  | See SLN section below    | The recorded level solution. The PSLN section is compressed, the SLN section is not. |
| STAT       | See STAT section below   | The state for some level variables |
| NEXT       | No content (length is 0) | Means that the data for the previously-described level is over, and that the next data is for a different solution |
| END        | No content (length is 0) | Signifies end of file |

Note that the FILE, TYPE, NAME and PASS sections can be omitted in a solution record to reffer to the previous solution data for them.

#### Section packing

"PSLN" sections are packed via the same packing algorithm as C2M.

### SLN Section

The SLN section stores the solution for the specified level. It is
similar to the REPL section of C2M files, but they are not the same.

The contents of this section are as follows:

| Bytes  | Content                     |
|--------|-----------------------------|
| 1      | The number of the player    |
| Varies | A sequence of input changes |

Multiple SLN sections can be set for a single level for multiple
players.

#### Input change

Specifies a change in input:

| Bytes | Content                                                                                                                                                                           |
|-------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1     | An input bitmask specifying the new input                                                                                                                                         |
| 1     | Number of subticks this input is held for. Last input must have length 0xff, specifying infinite length. Otherwise \<= 0xfc. Larger delays are specified via multiple input changes |

#### Input bitmask

Specifies which keys are pressed, any number of bits can be combined:

| Bitmask | Meaning       |
|---------|---------------|
| 0x1     | Up            |
| 0x2     | Right         |
| 0x4     | Down          |
| 0x8     | Left          |
| 0x10    | Drop item     |
| 0x20    | Cycle items   |
| 0x40    | Switch player |

### STAT section

The STAT section contains variables which are most likely to cause a
change on the level outcome, contrary to some data in the MISC section,
which can only be vital in obscure scenarios.

This section is made up of many sub-sections, each for a single
variable, for extensibility.

A single subsection looks like this:

| Bytes  | Content                                                                                 |
|--------|-----------------------------------------------------------------------------------------|
| 1      | The ID of the section                                                                   |
| 1      | Length of the section, in bytes. (Multiple sub-sections should be used for larger data) |
| Varies | The sub-section data itself                                                             |

Here is a list of existing sub-section types:

| ID   | Length | Data description                         |
|------|--------|------------------------------------------|
| 0x01 | 1      | Random force floor initial direction |
| 0x02 | 1      | Blob randomness seed                 |

<!-- TODO D&R actors? -->
