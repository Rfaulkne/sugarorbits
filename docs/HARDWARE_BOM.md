# Sugar Orbits hardware BOM and enclosure references

Last verified: 2026-09-20

This is the hardware configuration used for the Raspberry Pi round-display build. Prices are intentionally omitted because they change; manufacturer and supplier identifiers are included instead.

## Installed hardware

| Qty | Item | Exact model / identifier | Status and notes |
| ---: | --- | --- | --- |
| 1 | Single-board computer | Raspberry Pi 4 Model B, 2 GB RAM (`RPI4B-2GB`) | Installed. Board envelope 85 × 56 mm. |
| 1 | Round touch display | Waveshare 3.4inch DSI LCD (C), 800 × 800, SKU 24321 / BerryBase `WS-24321` | Installed. DSI video and I2C touch. |
| 1 | Storage | SanDisk High Endurance microSDXC, 64 GB, UHS-I U3 | Installed. More than sufficient for the 35-day glucose archive. |
| 1 | Power supply | Official Raspberry Pi USB-C PSU, 5.1 V / 3 A, EU (`RPI4NT3AW`) | Installed. Powers the Pi; the display receives 5 V from the Pi harness. |
| 1 | DSI cable | 15-pin DSI/FPC cable for Pi 4 | Included with the display; use the shortest cable that routes without a sharp fold. |
| 1 | Touch/power harness | PH2.0 4-pin cable, approximately 200 mm | Included with the display. Verify the PCB labels rather than trusting wire colour alone. |
| 1 set | Passive heatsinks | Four-piece Raspberry Pi 4 silver heatsink set (`RPI-4KKS`) | Purchased/optional. Keep the heatsinks facing the ventilated rear cover if installed. |
| 4 | Pi mounting spacers | M2.5 female–female, 10–12 mm recommended | Replacement for the supplied tall spacers if physical clearance is verified unpowered. Start at 12 mm. |
| 4 | Pi mounting screws | M2.5, length selected for spacer thread depth | Do not overtighten the Raspberry Pi PCB. |
| 4 | Enclosure mounting fasteners | M4 | The display carrier drawing calls out M4 enclosure holes. Exact outer-hole coordinates are not fully dimensioned by Waveshare; measure the actual unit before final machining. |

## Confirmed harness mapping on this unit

The installed harness was traced from the labels on the Waveshare PCB as follows. Cable colours are not a universal standard and must be checked against the board silkscreen on any replacement cable.

| Waveshare signal | Observed colour | Raspberry Pi 4 physical pin |
| --- | --- | --- |
| `5V` | Yellow | Pin 4 — 5 V |
| `GND` | Blue | Pin 6 — ground |
| `SDA` | Purple | Pin 3 — GPIO2 / SDA1 |
| `SCL` | Green | Pin 5 — GPIO3 / SCL1 |

## Waveshare mechanical dimensions

Dimensions below are transcribed from the supplier/manufacturer drawing for the exact **3.4inch DSI LCD (C)**. Units are millimetres.

| Feature | Dimension | Confidence / interpretation |
| --- | ---: | --- |
| Outer circular carrier diameter | Ø115.00 | Explicitly dimensioned. Use this for the enclosure front envelope. |
| Display/front active circle | Ø87.60 | Explicitly dimensioned. |
| Display assembly depth shown | 17.00 | Explicit side-view maximum shown before adding the Raspberry Pi. |
| Front display/glass stack shown | 6.00 | Explicitly shown in the side view. |
| Main rear PCB / Pi board envelope | 85.00 × 56.00 | Explicitly dimensioned. |
| Electronics envelope including lower connector area | 85.00 × 65.00 | Explicitly dimensioned. |
| Raspberry Pi mounting pattern | 58.00 × 49.00 | Explicitly dimensioned; matches the official Pi 4 mounting-hole pitch. |
| Raspberry Pi mounting holes | 4 × Ø2.75; use M2.5 fasteners | Hole diameter comes from the official Raspberry Pi 4 mechanical drawing. |
| Outer carrier enclosure holes | 4 × M4 | Waveshare specifies the size but does **not** provide a complete, datum-based X/Y pattern. A calibrated front-on product image suggests a nominal 75 × 75 mm square pattern; treat that as provisional until the physical part is measured. |

### Important enclosure limitation

Waveshare publishes a raster mechanical image rather than a tolerance-controlled STEP/DXF for this product. It identifies the four carrier holes as M4, but it does not dimension their centre locations relative to the display centre. Scaling the manufacturer's straight-on rear photograph against the Ø115 mm carrier gives approximately 75 × 75 mm, consistent with a nominal square pattern, but this is not a substitute for a dimensioned drawing. For a reliable enclosure:

1. use Ø115.0 mm for the carrier envelope;
2. measure the four M4 hole centres on the physical display with calipers;
3. model the measured pattern parametrically; and
4. print a thin test plate before committing to the final enclosure.

Record the measured horizontal and vertical centre-to-centre values here once verified:

- M4 horizontal pitch: `nominal 75 mm — TBD from physical part`
- M4 vertical pitch: `nominal 75 mm — TBD from physical part`
- Pattern offset from circular centre: `TBD from physical part`

## Enclosure design guidance

- Mount the Pi with its flat underside toward the Waveshare PCB and its processor/heatsinks toward the ventilated rear cover.
- Begin with 12 mm M2.5 spacers; reduce to 10 mm only after checking every component and solder joint for at least 2–3 mm clearance.
- Leave approximately 5 mm free air behind the tallest heatsink and provide vents at the upper and lower rear edges.
- Provide access to the Pi USB-C power connector and microSD card, or make the rear shell removable.
- Avoid a sharp fold in the DSI cable and provide strain relief so enclosure assembly does not pull on either FFC connector.
- Treat the 17 mm display depth as only the screen subassembly. Final wall depth also includes the Pi spacer, Pi component height, airflow and rear-shell thickness.

## Source links

- [Waveshare product page — 3.4inch DSI LCD (C)](https://www.waveshare.com/3.4inch-dsi-lcd-c.htm)
- [Supplier/manufacturer dimension image](https://cdn.static.spotpear.com/uploads/picture/product/raspberry-pi/raspberry-pi-lcd-module/3.4inch-dsi-lcd-c/3.4inch-dsi-lcd-c-19.jpg)
- [BerryBase listing — WS-24321](https://www.berrybase.de/waveshare-3.4-zoll-dsi-lcd-c-rund-ips-800x800-kapazitiver-10-punkt-touch-optical-bonding)
- [Official Raspberry Pi 4 mechanical drawing](https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-mechanical-drawing.pdf)
- [Official Raspberry Pi 4 product page and 15 W power recommendation](https://www.raspberrypi.com/products/raspberry-pi-4-model-b/)

Before ordering a machined enclosure, verify the dimensions against the physical parts. Supplier drawings may change without a part-number revision and do not state tolerances for every feature.
