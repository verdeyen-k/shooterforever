# 🔫 Shooter Forever

Build your own gun, then fight waves of animals that never stop coming.

**Play it at https://verdeyengames.com/shooterforever/**

## How to play

- Move with **WASD** or the arrow keys, aim with the **mouse**, and **hold click** (or Space) to shoot. **R** reloads, **P** or Esc opens the menu, and 🔄 restarts.
- On a phone or tablet, drag on the left side to move, and touch the right side to aim and shoot.
- Only plain bullets lie around the board in 📦 bullet boxes. Your gun turns them into whatever bullets you bought.
- Animals drop **⚡ electrocoins**. You also get a bonus for every wave you finish. You keep your electrocoins when you get knocked out.

## Play with friends

Press **👫 Play with friends**, make a room, and tell your friends the 4-letter code. Up to 4 players.

- Everyone brings the gun from **their own** Gun Workshop. You can change your gun in the room before the game starts.
- Everyone keeps **all** the electrocoins the team picks up.
- If you get knocked out, you come back at the start of the next wave. The game is over when everyone is knocked out.
- Only the host (👑) can start or restart the game. If the host leaves, the room closes.
- Players are shown by colour (Blue, Pink, Green, Purple). There are no names and no chat.

## The enemies

- **Lazer Duck**: keeps its distance and charges a lazer. Get out of the red dotted line!
- **Cannon Cow**: slow and tough, and shoots cannonballs.
- **Super Chicken**: has 5 barrels and shoots 5 eggs at once. Shows up from wave 3.

## Gun Workshop

Spend electrocoins on gun parts. Once you buy a part it's yours forever, and you can swap between the parts you own.

- **Ammo**: how many bullets before you reload (8 up to 70).
- **Barrel**: longer barrels hit harder and shoot faster bullets, but you can't shoot as quickly.
- **Scope**: you see further, get an aim line, and your aim is steadier.
- **Bullets**: Regular, Bouncy, Fire, Freeze, Electric and Explosive. Tap more than one to **combine** them: a Fire + Electric + Bouncy bullet does all three! Regular can't be part of a combo: picking it goes back to plain bullets.

Your electrocoins, parts and best wave save on this device.

## Files

- `index.html`: the screens and styles.
- `shooter.js`: everything else: the gun parts, the animals, the waves, drawing, sound and the online rooms.

Online rooms use the Firebase Realtime Database (the `kvgames` project the other games use), under `games/shooterforever/rooms/<CODE>`. The host's device runs the game and sends everyone a snapshot about 15 times a second. Everyone else sends what they're pressing. If you change what the host sends, bump `PROTOCOL` in `shooter.js`.
- `version.txt`: the newest version number. When you change the game, bump it here and in `index.html` (`?v=` on the script and `var V =`), so old copies in browsers reload themselves.
