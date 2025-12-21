# SFX lists

## Common sounds

| CC2 name        | Usage                 |
| --------------- | --------------------- |
| force           | Force floor           |
| newwall         | Exiting recessed wall |
| push            | Pushing block         |
| teleport        | Teleport              |
| thief           | Thief steal           |
| wall            | Bumped                |
| water           | Water walk            |
| burn            | Explosion death       |
| ice             | Ice walking           |
| splash          | Water death           |
| dirt            | Dirt clear            |
| button          | Button press          |
| get             | Item get              |
| slide           | Ice slide             |
| fire            | Fire walk             |
| door            | Door open             |
| socket          | Socket open           |
| BummerM         | Chip death            |
| BummerF         | Melinda death         |
| teleport-male   | Chip win              |
| teleport-female | Melinda win           |

## Unused CC2 sounds

| CC2 name | Notes                                                   |
| -------- | ------------------------------------------------------- |
| slide1   |                                                         |
| BLOOP    |                                                         |
| BEEP     | Exit sound without player voice; same as teleport sound |
| exit     |

## SFX usage

| CC2 name        | Old internal name | When it happens                                                                                                       |
| --------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| newwall         | "recessed wall"   | Exiting recessed wall                                                                                                 |
| burn            | "explosion"       | Explosion animation spawn                                                                                             |
| splash          | "splash"          | Water animation spawn                                                                                                 |
| teleport        | "teleport"        | TP completelyJoined                                                                                                   |
| thief           | "robbed"          | Thief completelyJoined                                                                                                |
| dirt            | "dirt clear"      | Dirt completelyJoined                                                                                                 |
| button          | "button press"    | Button completelyJoined                                                                                               |
| push            | "block push"      | Block pushed                                                                                                          |
| force           | "force floor"     | Repeating. Played when on FF                                                                                          |
| wall            | "player bump"     | Visual bumped state false -> true                                                                                     |
| water           | "water step"      | Water completelyJoined with boots                                                                                     |
| ice             | "slide step"      | Ice, FF completelyJoined with boots. Note: Holding a bonking direction on FF results in the SFX constantly restarting |
| slide           | "ice slide"       | Repeating. Played when _leaving_ ice. What??                                                                          |
| fire            | "fire step"       | Fire completelyJoined with boots                                                                                      |
| get             | "item get"        | (Player) item completelyJoined                                                                                        |
| socket          | "socket unlock"   | Socket completelyJoined                                                                                               |
| door            | "door unlock"     | Door completelyJoined                                                                                                 |
| teleport-male   | "chip win"        | Player win                                                                                                            |
| teleport-female | "melinda win"     | Player win                                                                                                            |
| BummerM         | "chip death"      | Player death. Note: plays after burn/splash. Delay seemingly hardcoded.                                               |
| BummerF         | "melinda death"   | Player death. Note: plays after burn/splash. Delay seemingly hardcoded.                                               |
