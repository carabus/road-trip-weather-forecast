const WEATHER_SEARCH_URL = "https://api.darksky.net/forecast";
const API_KEY = "58b9faa457bb82b97af590775731c37a";

let autocompleteList = [];

let infoWindows = [];

let infoWindowsContent = [];

let countries = {
  us: {
    center: { lat: 37.1, lng: -95.7 },
    zoom: 3
  }
};
let map;

$(processTrip);

/** Inits Google Maps and handles all application events */
function processTrip() {
  initMap();
  handleDatesComplete();
  handleItineraryComplete();
  handleRestart();
  handleHideHelpMessage();
}

/** Disable form */
function disableForm(formClass) {
  $(`.${formClass}`)
    .find('fieldset, button[type="submit"]')
    .attr("disabled", "disabled");
}

/** Enable form */
function enableForm(formClass) {
  $(`.${formClass}`)
    .find('fieldset, button[type="submit"]')
    .removeAttr("disabled");
}

/** Reset form */
function resetForm(formClass) {
  $(`.${formClass}`)[0].reset();
}

/**
 * Gets data from Dark Sky weather api
 * @param {*} cities list of cities to get weather for
 * @param {*} callback callback function
 */
function getDataFromApi(cities, callback) {
  const city = cities.shift();
  // Build api url based on parameters
  let completeUrl = `${WEATHER_SEARCH_URL}/${API_KEY}/${city.latitude},${
    city.longitude
  },${city.time}`;

  let settings = {
    url: completeUrl,
    data: {
      exclude: "minutely,hourly,alerts,flags"
    },
    dataType: "jsonp",
    type: "GET",
    success: function(response) {
      callback(response, city, cities);
    },
    error: displayErrorMessage
  };

  $.ajax(settings);
}

/**
 * Display general error message for the user if api call is unsuccessful
 */
function displayErrorMessage() {
  debugger;
  $("#error-result").text(
    "There was an error processing your request. Please try again."
  );
  $("#error-result").show();
}

/**
 * Format and display information from weather API
 * @param {*} data as returned by the API
 * @param {*} city current city being processed
 * @param {*} cities list of cities to get weather for
 */
function displaySearchData(data, city, cities) {
  const temperatureBlock = `
  <div class="temperature">
  <span class="high" aria-label="Daytime temperature">${Math.round(
    data.daily.data[0].temperatureHigh
  )}</span>
  <span class="divider"></span>
  <span class="low" aria-label="Nighttime temperature">${Math.round(
    data.daily.data[0].temperatureLow
  )}</span>
  </div>`;

  const weatherOnMapBlock = `
  <div class="info-window-block">
  <div>
  <div class="day">${city.day}</div>
  <div class="city">${city.name}</div>
  <div class="icon-map" style="background-image: url(icons/${
    data.daily.data[0].icon
  }.png)"></div>
  </div>
  ${temperatureBlock}
  </div>
  `;

  // generate info windows for showing on map
  generateMapInfoWindows(city.latitude, city.longitude, weatherOnMapBlock);

  // display search results
  $("#results-table").append(
    `<tr>
    <td>${city.day}</td>
    <td>${city.name}</td>
    <td><img class="icon" src="icons/${data.daily.data[0].icon}.png" alt="${
      data.daily.data[0].summary
    }"></td>
    <td>
    ${temperatureBlock}
    <div class="summary">${data.daily.data[0].summary}</div>
    </td>
    </tr>`
  );

  // api calls are chained to execute synchronously in order.
  if (cities.length > 0) {
    getDataFromApi(cities, displaySearchData);
  } else {
    displayInfoWindows();
    zoomOnFirstLocation();
  }
}
/**
 * Generate Google Maps info windows content without displaying them on the map
 * @param {*} latitude latitude where info window will be displayed
 * @param {*} longitude longitude where info window will be displayed
 * @param {*} weatherOnMapBlock info window content
 */
function generateMapInfoWindows(latitude, longitude, weatherOnMapBlock) {
  // If there already is info window at the same position - add content to it
  // Otherwise, create new info window
  let infoWindowAtPosition = infoWindowsContent.find(function(element) {
    return element.latitude === latitude && element.longitude === longitude;
  });

  if (infoWindowAtPosition) {
    infoWindowAtPosition.contentString += weatherOnMapBlock;
  } else {
    infoWindowsContent.push({
      latitude,
      longitude,
      contentString: weatherOnMapBlock
    });
  }
}

/**
 * Display info windows on Google Map
 */
function displayInfoWindows() {
  infoWindowsContent.forEach(function(element) {
    let infoWindow = new google.maps.InfoWindow({
      content: element.contentString
    });
    infoWindow.setPosition({ lat: element.latitude, lng: element.longitude });
    infoWindow.open(map);
    infoWindows.push(infoWindow);
  });
}

/**
 * Initialise location inputs with Google Places autocompletes
 * @param {*} autocompleteInputIds list of location inputs ids
 */
function initAutocompletes(autocompleteInputIds) {
  autocompleteInputIds.forEach(function(element) {
    autocomplete = new google.maps.places.Autocomplete(
      document.getElementById(element),
      {
        types: ["(cities)"],
        componentRestrictions: { country: "us" }
      }
    );
    autocompleteList.push(autocomplete);

    // prevent from submitting on Enter
    preventAutocompleteSubmit(element);
  });
}

/**
 * Generate and display location inputs base on the trip duration entered by the user
 * @param {*} duration
 */
function displayItineraryForm(duration) {
  // we need to populate itinerary form with numberOfDays number of inputs
  let itineraryFormContents = "";
  let autocompleteInputIds = [];
  for (let i = 0; i < duration; i++) {
    itineraryFormContents = itineraryFormContents.concat(`<label for="city-autocomplete${i}" class="required">Day ${i +
      1}</label>
        <input type="text" id="city-autocomplete${i}" required placeholder="Enter a US location">
        `);
    autocompleteInputIds.push(`city-autocomplete${i}`);
  }

  $("#places").html(itineraryFormContents);

  // init itinerary form with Google Maps autocomplete
  initAutocompletes(autocompleteInputIds);

  // and then show it
  $(".itinerary").show();
}

/** Handle submit of Trip Dates form */
function handleDatesComplete() {
  $(".dates").submit(function(event) {
    event.preventDefault();
    disableForm("dates");
    $(this)
      .find("#submit1")
      .hide();
    let duration = $("#duration").val();

    displayItineraryForm(duration);
  });
}

/** Handle submit of Trip Itinerary form */
function handleItineraryComplete() {
  $(".itinerary").submit(function(event) {
    event.preventDefault();
    disableForm("itinerary");

    const startDate = $("#startDate").val();

    let apiRequests = [];
    // get location information from autocompleteInputIds
    autocompleteList.forEach(function(city, index) {
      apiRequests.push({
        day: `Day&nbsp;${index + 1}`,
        name: city.getPlace().name,
        latitude: city.getPlace().geometry.location.lat(),
        longitude: city.getPlace().geometry.location.lng(),
        time: calculateDate(startDate, index)
      });
    });

    $("#help").hide();
    $("#results").show();
    $("#map").show();

    // send consecutive api requests
    getDataFromApi(apiRequests, displaySearchData);
  });
}

/**
 * Calculate date for each day of the trip
 * @param {*} startDate start date of the trip
 * @param {*} index number of days to add
 */
function calculateDate(startDate, index) {
  const date = new Date(startDate);
  //getting seconds since Jan 1, 1970, 00:00:00.000 + index amount of days
  return Math.trunc(date.getTime() / 1000) + 60 * 60 * 24 * index;
}

/** initialize Google Maps widget */
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: countries["us"].zoom,
    center: countries["us"].center,
    mapTypeControl: false,
    panControl: false,
    zoomControl: false,
    streetViewControl: false
  });
}

/** remove info windows from map. revert map zoom to default */
function cleanUpMap() {
  infoWindows.forEach(infoWindow => infoWindow.setMap(null));
  map.setZoom(countries["us"].zoom);
  map.setCenter(countries["us"].center);
}

/** app state clean up on pressing Restart button */
function handleRestart() {
  $(".restart").click(function(event) {
    // reset and enable dates form
    resetForm("dates");
    enableForm("dates");
    // show submit button on dates form
    $("#submit1").show();
    //enable itinerary form
    enableForm("itinerary");
    // hide itinerary form
    $(".itinerary").hide();
    // clean place inputs from itinerary form
    $("#places").empty();
    // hide map
    $("#map").hide();
    // clean up markers on the map and set initial focus
    cleanUpMap();
    // clean up weather data from table
    $("#results-table").empty();
    $("#results").hide();
    $("#error-result").hide();
    // clean up
    autocompleteList = [];
    infoWindows = [];
    // clean up divs created by Places autocomplete
    $(".pac-container").remove();
  });
}
/**
 * Prevents form submit when user clicks Enter in autocomplete
 * @param {*} autocompleteId autocomplete input id
 */
function preventAutocompleteSubmit(autocompleteId) {
  $(`#${autocompleteId}`).keydown(function(e) {
    if (e.which == 13) {
      return false;
    }
  });
}

/** Hide application help message */
function handleHideHelpMessage() {
  $("#hide-help-message").click(function(event) {
    $("#help").hide();
  });
}

/** Zoom map on first location of the trip */
function zoomOnFirstLocation() {
  map.setZoom(4);
  map.panTo(infoWindows[0].position);
}
