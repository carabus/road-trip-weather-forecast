const WEATHER_SEARCH_URL = "https://api.darksky.net/forecast";
const API_KEY = "58b9faa457bb82b97af590775731c37a";

let autocompleteList = [];

let infoWindows = [];

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
      exclude: "currently,minutely,hourly,alerts,flags"
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

  const contentString = `<img class="icon" src="icons/${data.daily.data[0].icon}.png">
  <span class="temp-max">${data.daily.data[0].temperatureHigh}</span>
  <span class="temp-min">${data.daily.data[0].temperatureLow}</span>`;
  // show results on map
  setWeatherOnMap(city.latitude, city.longitude, contentString);
  
  // display search results
  $("#results-table").append(
    `<tr>
    <td>${city.day}</td>
    <td>${city.name}</td>
    <td>${contentString}</td>
    </tr>`
  );

  if (cities.length > 0) {
    getDataFromApi(cities, displaySearchData);
  }
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
    itineraryFormContents = itineraryFormContents.concat(`<label for="city-autocomplete${i}" class="required">Day ${i+1}</label>
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
    $(this).find('#submit1').hide();
    let numberOfDays = $("#numberOfDays").val();
    // if numberOfDays is too big - maximum of 10 location inputs will be displayed
    if(Number(numberOfDays) > 10) {
      numberOfDays=10;
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
        day: `Day ${index + 1}`,
        name: city.getPlace().formatted_address,
        latitude: city.getPlace().geometry.location.lat(),
        longitude: city.getPlace().geometry.location.lng(),
        time: calculateDate(startDate, index)
      });
    });

    console.log(apiRequests);

    $('#results').show();

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

function setWeatherOnMap(latitude, longitude, contentString) {
    let infoWindow = new google.maps.InfoWindow({
      content: contentString
    });
    infoWindow.setPosition({lat: latitude, lng: longitude});
    infoWindow.open(map);
    infoWindows.push(infoWindow);
}

function cleanUpMap() {
  infoWindows.forEach(infoWindow => infoWindow.setMap(null));
  map.setZoom(countries["us"].zoom);
  map.setCenter(countries["us"].center);
}

function handleRestart() {
  $('.restart').click(function(event) {
    // reset and enable dates form
    resetForm('dates');
    enableForm('dates')
    // show submit button on dates form
    $('#submit1').show();
    // hide itinerary form
    $('.itinerary').hide();
    // clean place inputs from itinerary form
    $('#places').empty();
    // clean up markers on the map and set initial focus
    cleanUpMap();
    // clean up weather data from table
    $('#results-table').empty();
    $('#results').hide();
  });
}

function preventAutocompleteSubmit(autocompleteId) {
  $(`#${autocompleteId}`).keydown(function (e) {
    if (e.which == 13 && $('.pac-container:visible').length) return false;
  });
}

function processTrip() {
  preventAutocompleteSubmit();
  initMap();
  handleDatesComplete();
  handleItineraryComplete();
  handleRestart();
}

$(processTrip);
