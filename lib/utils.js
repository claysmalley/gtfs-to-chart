import path from 'node:path';
import { readFileSync } from 'node:fs';

import { find, max, map, maxBy, size, every, uniq, groupBy, first, sortBy } from 'lodash-es';
import { getStops, openDb, getStoptimes, getAgencies, getRoutes } from 'gtfs';
import sanitize from 'sanitize-filename';
import moment from 'moment';
import 'moment-timezone';
import sqlString from 'sqlstring';
import fetch from 'node-fetch';

import { renderTemplate } from './file-utils.js';
import { formatRouteName } from './formatters.js';
import { pageList } from './data/pages.js';
import { stationList } from './data/stations.js';
import { routeList } from './data/routes.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

function parseTime(string, date, timezone) {
  string = `00${string}`.slice(-9);
  const day = Math.floor(string.slice(0,3) / 24);
  const hours = `0${string.slice(0,3) % 24}`.slice(-2);
  const minutes = string.slice(4,6);
  return moment.tz(`${moment(date).add(day, 'days').format('YYYY-MM-DD')}T${hours}:${minutes}`, 'YYYY-MM-DDTHH:mm', timezone).toDate();
}

/*
 * Calculate the distance between two coordinates.
 */
function calculateDistanceMi(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const radlat1 = Math.PI * lat1 / 180;
  const radlat2 = Math.PI * lat2 / 180;
  const theta = lon1 - lon2;
  const radtheta = Math.PI * theta / 180;
  let dist = (Math.sin(radlat1) * Math.sin(radlat2)) + (Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta));
  if (dist > 1) {
    dist = 1;
  }

  dist = Math.acos(dist);
  dist = dist * 180 / Math.PI;
  dist = dist * 60 * 1.1515;
  return Math.min(40, Math.max(15, dist));
}

/*
 * Reverse the distances between stations for opposite trip direction
 */
const reverseStationDistances = (stations, oppositeDirectionDistance) => {
  const tripDistance = max(map(stations, 'distance'));
  for (const station of stations) {
    // Scale distances to match opposite direction total distance
    station.distance = (tripDistance - station.distance) * oppositeDirectionDistance / tripDistance;
  }
};

/*
 * Determine if a stoptime is a timepoint.
 */
const isTimepoint = stoptime => {
  if (stoptime.timepoint === null) {
    return stoptime.arrival_time !== '' && stoptime.departure_time !== '';
  }

  return stoptime.timepoint === 1;
};

const getStationsFromTrip = async (trip, defaultTimezone, agencyKey, noStopCode) => {
  const stops = await Promise.all(trip.stoptimes.map(async stoptime => {
    const stops = await getStops({
      stop_id: stoptime.stop_id
    });

    if (stops.length === 0) {
      throw new Error(`Unable to find stop id ${stoptime.stop_id}`);
    }

    return stops[0];
  }));

  let previousStationCoordinates;
  return trip.stoptimes.map((stoptime, index) => {
    const stop = stops[index];
    const hasShapeDistance = every(trip.stoptimes, stoptime => stoptime.shape_dist_traveled != null);

    if (!hasShapeDistance) {
      if (index === 0) {
        stoptime.shape_dist_traveled = 0;
      } else {
        const previousStopTime = trip.stoptimes[index - 1];
        const distanceFromPreviousStation = calculateDistanceMi(stop.stop_lat, stop.stop_lon, previousStationCoordinates.stop_lat, previousStationCoordinates.stop_lon);
        stoptime.shape_dist_traveled = previousStopTime.shape_dist_traveled + distanceFromPreviousStation;
      }

      previousStationCoordinates = {
        stop_lat: stop.stop_lat,
        stop_lon: stop.stop_lon
      };
    }

    const station = find(stationList[agencyKey], ['stop_id', stop.stop_id]);
    
    return {
      ...station,
      stop_id: stop.stop_id,
      stop_code: noStopCode ? null : stop.stop_code ?? stop.stop_id,
      name: stop.stop_name,
      distance: stoptime.shape_dist_traveled,
      direction_id: trip.direction_id,
      timezone: stop.stop_timezone ?? defaultTimezone,
    };
  });
};

/*
 * Get all trips and stoptimes for a given route
 */
const getDataforChart = async (config, page, agencyTimezone) => {
  const routeIds = page.routes;
  const days = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
  const db = await openDb(config);
  const notes = [];
  const chartDates = days.map((day) => moment(config.chartDate, 'YYYYMMDD').add(day, 'days').format('YYYYMMDD'));
  const daysOfWeek = chartDates.map((date) => moment(date, 'YYYYMMDD').format('dddd').toLowerCase());
  const agencyKey = config.agencies[0].agency_key;
  const noStopCode = config.noStopCode;
  var calendars = [];
  for (let day = 0; day < days.length; day++) {
    const calendar = await db.all(`SELECT DISTINCT service_id FROM calendar WHERE start_date <= ? AND end_date >= ? AND ${sqlString.escapeId(daysOfWeek[day])} = 1`, [
      chartDates[day],
      chartDates[day]
    ]);
    calendars.push(calendar);

    if (calendar.length === 0) {
      console.warn(`No calendars found for route ${page.label} on ${moment(chartDates[day], 'YYYYMMDD').format('MMM D, YYYY')}`);
    }
  }

  const serviceIds = calendars.map((calendar) => calendar.map(calendar => calendar.service_id));
  var tripsByDay = [];
  for (let day = 0; day < days.length; day++) {
    var formattedTrips = [];
    for (const i in routeIds) {
      const trips = await db.all(`SELECT service_id, trip_id, trip_short_name, direction_id, shape_id FROM trips where route_id = ? AND service_id IN (${serviceIds[day].map(() => '?').join(', ')})`, [
        routeIds[i],
        ...serviceIds[day]
      ]);
      const route = find(routeList[agencyKey], ['route_id', routeIds[i]]);
      formattedTrips.push(...trips.map(trip => {
        return {
          ...trip,
          route_id: routeIds[i],
          route_long_name: route.route_long_name,
          swap_evenodd: route.swap_evenodd ?? false,
        };
      }));
    }
    tripsByDay.push(formattedTrips);
  }

  if (tripsByDay.flat().length === 0) {
    throw new Error(`No trips found for route ${page.label} on ${moment(chartDates[0], 'YYYYMMDD').format('MMM D, YYYY')}`);
  }

  const shapeIds = uniq(tripsByDay.flatMap(trip => trip.shape_id));

  if (shapeIds.length === 0) {
    throw new Error('Route has no shapes.');
  }

  for (let day = 0; day < days.length; day++) {
    await Promise.all(tripsByDay[day].map(async trip => {
      const stoptimes = await getStoptimes(
        {
          trip_id: trip.trip_id
        },
        [
          'arrival_time',
          'departure_time',
          'stop_id',
          'shape_dist_traveled',
          'timepoint'
        ],
        [
          ['stop_sequence', 'ASC']
        ]
      );

      trip.stoptimes = stoptimes.filter(stoptime => isTimepoint(stoptime)).map(
        (stoptime) => {
          stoptime['arrival_time_utc'] = parseTime(stoptime.arrival_time, chartDates[day], agencyTimezone);
          stoptime['departure_time_utc'] = parseTime(stoptime.departure_time, chartDates[day], agencyTimezone);
          return stoptime;
        }
      );
      trip.start_day = day;
      trip.destination = find(stationList[agencyKey], ['stop_id', trip.stoptimes[trip.stoptimes.length - 1].stop_id]);
    }));
  }

  const trips = tripsByDay.flat();

  const longestTrip = {
    ...page,
    direction_id: 0,
  };
  let stations = await getStationsFromTrip(longestTrip, agencyTimezone, agencyKey, noStopCode);
  const tripDistance = max(map(stations, 'distance'));
  const directionGroups = groupBy(trips, 'direction_id');

  // If there are two directions, get stops in other direction
  if (size(directionGroups) > 1) {
    const oppositeDirection = longestTrip.direction_id === 1 ? '0' : '1';
    const longestTripOppositeDirection = {
      ...page,
      direction_id: oppositeDirection,
      stoptimes: longestTrip.stoptimes.reverse(),
    };
    const stationsOppositeDirection = await getStationsFromTrip(longestTripOppositeDirection, agencyTimezone, agencyKey, noStopCode);

    reverseStationDistances(stationsOppositeDirection, tripDistance);

    stations = [...stations, ...stationsOppositeDirection];
  }
  const hasShapeDistance = every(longestTrip.stoptimes, stoptime => stoptime.shape_dist_traveled !== null);
  if (!hasShapeDistance) {
    notes.push('Distance between stops calculated assuming a straight line.');
  }

  return {
    trips,
    stations,
    notes
  };
};

/*
 * Initialize configuration with defaults.
 */
export function setDefaultConfig(initialConfig) {
  const defaults = {
    beautify: false,
    gtfsToChartVersion: version,
    chartDate: moment().format('YYYYMMDD'),
    skipImport: false
  };

  return { ...defaults, ...initialConfig };
}

/*
 * Generate the HTML for the agency overview page.
 */
export async function generateOverviewHTML(config, routes) {
  const agency = config.agencies[0].agency_label;
  const agencyKey = config.agencies[0].agency_key;

  for (const route of routes) {
    route.relativePath = config.isLocal ? sanitize(route.url_slug) : sanitize(`${route.url_slug}.html`);
  }

  const templateVars = {
    agency,
    agencyKey,
    config,
    routes: sortBy(routes, r => Number.parseInt(r.route_short_name, 10))
  };
  return renderTemplate('overview_page', templateVars, config);
}

/*
 * Generate the HTML for a chart.
 */
export async function generateChartHTML(config, urlSlug, timezone) {
  const agencyKey = config.agencies[0].agency_key;
  const route = find(pageList[agencyKey], ['url_slug', urlSlug]);

  const chartData = await getDataforChart(config, route, timezone);

  return renderTemplate('chart_page', {
    routeName: route.label,
    chartData,
    agencyKey,
    config,
    moment
  }, config);
}
