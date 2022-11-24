This is a fork of [gtfs-to-chart](https://github.com/BlinkTagInc/gtfs-to-chart), customized to display Amtrak schedules.

This project is **not** affiliated with the National Railroad Passenger Corporation (Amtrak). See [amtrak.com](https://www.amtrak.com/) for up-to-date schedules and train statuses.

## gtfs-to-chart

`gtfs-to-chart` creates stringline charts showing all vehicles on a transit route from GTFS data.

[E.J. Marey](https://en.wikipedia.org/wiki/%C3%89tienne-Jules_Marey) was the first person to propose this type of graphical train schedule.

The chart generated shows stations across the x-axis, spaced to scale. Each line on the chart represents a transit vehicle moving through time. The slope of the line indicates speed at that point in the journey, with steeper slopes indicating slower speeds (as more time is passing as the vehicle moves). 

<img width="598" alt="SFMTA 14R Stringline Chart" src="https://user-images.githubusercontent.com/96217/87837133-6753cd80-c847-11ea-9df6-5807dbec9b20.png">

## Credits

This library was based off of code developed by [Mike Bostock](https://observablehq.com/@mbostock/mareys-trains).
