const WEATHER_SEARCH_URL = "https://api.darksky.net/forecast";
const API_KEY = "58b9faa457bb82b97af590775731c37a";

let autocompleteList = [];

let infoWindows = [];

let infoWindowsContent = [];

var countries = {
  us: {
    center: { lat: 37.1, lng: -95.7 },
    zoom: 3
  }
};
let map;

/** Disable form */
function disableForm(formClass) {
  $(`.${formClass}`)
    .find('input, button[type="submit"]')
    .attr("disabled", "disabled");
}

/** Enable form */
function enableForm(formClass) {
  $(`.${formClass}`)
    .find('input, button[type="submit"]')
    .removeAttr("disabled");
}

/** Reset form */
function resetForm(formClass) {
  $(`.${formClass}`)[0].reset();
}

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
    }
  };

  $.ajax(settings);
}

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

  if (cities.length > 0) {
    getDataFromApi(cities, displaySearchData);
  } else {
    displayInfoWindows();
    zoomOnFirstLocation();
  }
}

function generateMapInfoWindows(latitude, longitude, weatherOnMapBlock) {
  let infoWindowAtPosition = infoWindowsContent.find(function(element) {
    return element.latitude === latitude && element.longitude === longitude;
  });

  debugger;
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

function displayInfoWindows() {
  infoWindowsContent.forEach(function(element){
    let infoWindow = new google.maps.InfoWindow({
      content: element.contentString
    });
    infoWindow.setPosition({ lat: element.latitude, lng: element.longitude });
    infoWindow.open(map);
    infoWindows.push(infoWindow);
  })
}

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

function displayItineraryForm(numberOfDays) {
  // we need to populate itinerary form with numberOfDays number of inputs
  let itineraryFormContents = "";
  let autocompleteInputIds = [];
  for (let i = 0; i < numberOfDays; i++) {
    itineraryFormContents = itineraryFormContents.concat(`<label for="city-autocomplete${i}" class="required">Day ${i +
      1}</label>
        <input type="text" id="city-autocomplete${i}" required>
        `);
    autocompleteInputIds.push(`city-autocomplete${i}`);
  }

  $("#places").html(itineraryFormContents);
  // init itinerary form with Google Maps autocomplete
  initAutocompletes(autocompleteInputIds);

  // and then show it
  $(".itinerary").show();
}

function handleDatesComplete() {
  $(".dates").submit(function(event) {
    event.preventDefault();
    disableForm("dates");
    $(this)
      .find("#submit1")
      .hide();
    let numberOfDays = $("#numberOfDays").val();
    // if numberOfDays is too big - maximum of 10 location inputs will be displayed
    if (Number(numberOfDays) > 10) {
      numberOfDays = 10;
    }

    displayItineraryForm(numberOfDays);
  });
}

function handleItineraryComplete() {
  $(".itinerary").submit(function(event) {
    event.preventDefault();
    disableForm("itinerary");
    // get location information from autocompleteInputIds
    const startDate = $("#startDate").val();

    let apiRequests = [];

    autocompleteList.forEach(function(city, index) {
      apiRequests.push({
        day: `Day&nbsp;${index + 1}`,
        name: city.getPlace().name,
        latitude: city.getPlace().geometry.location.lat(),
        longitude: city.getPlace().geometry.location.lng(),
        time: calculateDate(startDate, index)
      });
    });

    console.log(apiRequests);
    $("#help").hide();
    $("#results").show();
    $("#map").show();

    // send consecutive api requests
    getDataFromApi(apiRequests, displaySearchData);
  });
}

function calculateDate(startDate, index) {
  const date = new Date(startDate);
  //getting seconds since Jan 1, 1970, 00:00:00.000 + index amount of days
  return Math.trunc(date.getTime() / 1000) + 60 * 60 * 24 * index;
}

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

function cleanUpMap() {
  infoWindows.forEach(infoWindow => infoWindow.setMap(null));
  map.setZoom(countries["us"].zoom);
  map.setCenter(countries["us"].center);
}

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
    // clean up
    autocompleteList = [];
    infoWindows = [];
    // clean up divs created by Places autocomplete
    $(".pac-container").remove();
  });
}

function preventAutocompleteSubmit(autocompleteId) {
  $(`#${autocompleteId}`).keydown(function(e) {
    console.log($(".pac-container:visible").length);
    if (e.which == 13) {
      return false;
    }
  });
  /*
  $(`#${autocompleteId}`).on({ 'touchstart' : function(e){
    if ($('.pac-container:visible').length) return false;
    } });
    */
}

function handleHideHelpMessage() {
  $("#hide-help-message").click(function(event) {
    $("#help").hide();
  });
}

function zoomOnFirstLocation() {
  map.setZoom(4);
  map.panTo(infoWindows[0].position);
}

function processTrip() {
  initMap();
  handleDatesComplete();
  handleItineraryComplete();
  handleRestart();
  handleHideHelpMessage();
}

$(processTrip);
