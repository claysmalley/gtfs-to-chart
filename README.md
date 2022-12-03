* [Amtrak](https://claysmalley.github.io/gtfs-to-chart/charts/amtrak/index.html)
* [VIA Rail Canada](https://claysmalley.github.io/gtfs-to-chart/charts/via_rail/index.html)
* [Brightline](https://claysmalley.github.io/gtfs-to-chart/charts/brightline/florida.html)
* [Tri-Rail](https://claysmalley.github.io/gtfs-to-chart/charts/trirail/trirail.html)
* [NICTD South Shore Line](https://claysmalley.github.io/gtfs-to-chart/charts/nictd/south-shore.html)
* [MARC](https://claysmalley.github.io/gtfs-to-chart/charts/marc/index.html)
* [Sonoma-Marin Area Rail Transit](https://claysmalley.github.io/gtfs-to-chart/charts/smart/mainline.html)

This is a customized fork of [gtfs-to-chart](https://github.com/BlinkTagInc/gtfs-to-chart).

`gtfs-to-chart` creates stringline charts showing all vehicles on a transit route from GTFS data.

[E.J. Marey](https://en.wikipedia.org/wiki/%C3%89tienne-Jules_Marey) was the first person to propose this type of graphical train schedule.

The chart generated shows stations across the x-axis, spaced to scale. Each line on the chart represents a transit vehicle moving through time. The slope of the line indicates speed at that point in the journey, with steeper slopes indicating slower speeds (as more time is passing as the vehicle moves). 

<img width="598" alt="SFMTA 14R Stringline Chart" src="https://user-images.githubusercontent.com/96217/87837133-6753cd80-c847-11ea-9df6-5807dbec9b20.png">

## Credits

This library was based off of code developed by [Mike Bostock](https://observablehq.com/@mbostock/mareys-trains).
