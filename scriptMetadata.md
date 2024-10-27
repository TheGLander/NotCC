# CC2 Script Metadata

In Chip's Challenge 2, a set may specfify its name by leaving a string in the first line of its main script. This document describes a method for specifying additional metadata using comments in the C2G file. This syntax is supported by NotCC.

## Syntax

Script metadata is specified using specially-formatted comments, called **metadata field**s:

- A metadata field is of the format `; meta [KEY]: [VALUE]`, with the field's key and value being `[KEY]` and `[VALUE]`, respectively. The key is terminated by a colon, and the value is terminated by a newline or end of file.
- Metadata fields may be anywhere in the script. For readability, fields should be near the top of the script.
- Multiple fields with the same key will be concatenated with a newline.
- Fields with unknown keys should be ignored.

## Example

```
game "Cromulent Mazes"
; meta by: Chip McCallahan
; meta description: A variety of levels inspired by mazes.
; meta description: Enjoy!
; meta difficulty: 3.5
```

## All fields

| Key                | Functionality                                                                | Value                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `by`               | Who made this set                                                            | A string. Multiple authors may be separated using commas.                                                                                                                                                                                                                                                                                                     |
| `description`      | A short (one paragraph max) description of what this set is or who it is for | A string                                                                                                                                                                                                                                                                                                                                                      |
| `difficulty`       | How difficult this set is to solve. The CC2 basegame is 3 stars.             | A floating-point number between 0 and 5 (inclusive).                                                                                                                                                                                                                                                                                                          |
| `thumbnail`        | What this set's thumbnail should be in a set grid                            | `first level` - this set's thumbnail should be a map of the set's first level. `image` - this set's thumbnail is an image located in the same directory as the script named "preview.png". `none` - this set shouldn' t display a thumbnail. By default, this field is either `image` or `first level`, depending on if there's an preview.png file detected. |
| `listing priority` | Where this set should be put relative to other sets in a set grid            | `top` - this set should be put above other levels. Avoid this value for public sets. `bottom` - this set should be put after all other sets. `unlisted` - don't show this set in a set grid. By default, this set is put between `top` and `bottom` sets.                                                                                                     |
