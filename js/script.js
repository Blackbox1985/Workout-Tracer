"use strict";

// SELECTORS
const workoutContainer = document.querySelector(".workouts");
// Add-workout form
const form = document.querySelector("#form");
const workoutType = document.querySelector("#workout-type");
const workoutDistance = document.querySelector("#distance");
const workoutDuration = document.querySelector("#duration");
const workoutCadence = document.querySelector("#cadence");
const workoutElevation = document.querySelector("#elevation");
// Edit-workout form
const formEdit = document.querySelector("#form-editing");
const workoutTypeEditForm = document.querySelector("#workout-type-e");
const workoutDistanceEditForm = document.querySelector("#distance-e");
const workoutDurationEditForm = document.querySelector("#duration-e");
const workoutCadenceEditForm = document.querySelector("#cadence-e");
const workoutElevationEditForm = document.querySelector("#elevation-e");
const saveChanges = document.querySelector(".form__btn--save");
const cancelChanges = document.querySelector(".form__btn--cancel");
// Form errors
const formError = document.querySelector("#form-control");
const formEditError = document.querySelector("#form-editing-control");
const dismissBtns = document.querySelectorAll(".form__btn--dismiss");
// Delete All workouts box
document;
const deleteContainer = document.querySelector(".delete-confirmation");
// Sorting
const sortChoice = document.querySelector("#sort-choice");

// CLASSES REFACTORING
class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);

  constructor(coords, distance, duration, city, country) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
    this.city = city;
    this.country = country;
  }

  _setDescription() {
    this.description = `${
      this.type[0].toUpperCase() + this.type.slice(1)
    } on ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
      this.date
    )}`;
  }
}

class Running extends Workout {
  type = "running";

  constructor(coords, distance, duration, city, country, cadence) {
    super(coords, distance, duration, city, country);
    this.cadence = cadence;
    this._calcPace();
    this._setDescription();
  }

  _calcPace() {
    this.pace = this.duration / this.distance;
  }
}

class Cycling extends Workout {
  type = "cycling";

  constructor(coords, distance, duration, city, country, elevationGain) {
    super(coords, distance, duration, city, country);
    this.elevationGain = elevationGain;
    this._calcSpeed();
    this._setDescription();
  }

  _calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
  }
}

// Controller Class
class App {
  // Creo il private field userCoords con le coordinate iniziali dell'utente perchè mi serviranno per riposizionare la mappa sulle coordinate iniziali se l'utente elimina tutti i workouts (Delete All)
  #userCoords = [];
  #map;
  #mapEvent;
  #workouts = [];
  // L'array dei markers mi serve per salvare tutti i markers (che sono oggetti leaflet) in un unico array in modo da poterli recuperare (ad esempio tramite le coordinate) quando devo modificare un workout (e il corrispettivo marker) o eliminare un workout (e il corrispettivo marker)
  // Inoltre è indispensabile per integrare la funzionalità Show All che mostra tutti i markers nel mondo
  #workoutMarkers = [];
  #mapZoomLevel = 13;

  constructor() {
    this._getLocation();
    workoutType.addEventListener(
      "change",
      this._toggleElevationField.bind("_", workoutCadence, workoutElevation)
    );
    workoutTypeEditForm.addEventListener(
      "change",
      this._toggleElevationField.bind(
        "_",
        workoutCadenceEditForm,
        workoutElevationEditForm
      )
    );
    form.addEventListener("submit", this._newWorkout.bind(this));
    formEdit.addEventListener("submit", this._editWorkout.bind(this));
    dismissBtns.forEach(btn =>
      btn.addEventListener("click", this._dismissError)
    );
    cancelChanges.addEventListener("click", this._cancelEdit);
    document.body.addEventListener("click", this._handleClick.bind(this));
    deleteContainer.addEventListener("click", this._handleDelete.bind(this));
    // Form problem on mobile when android keyboard is active
    this._checkMobile();
  }

  _checkMobile() {
    if (window.innerWidth < 768) {
      window.addEventListener("resize", function () {
        if (
          !form.classList.contains("hidden") ||
          !formEdit.classList.contains("form-editing--hidden")
        ) {
          document.querySelector(".side").style.maxHeight = "77%";
        } else {
          document.querySelector(".side").style.maxHeight = "47%";
        }
      });
    }
  }

  _checkWorkouts() {
    // Disabilito le voci di menu se non ci sono workouts e ripristino l'etichetta di sort (date)
    if (this.#workouts.length === 0) {
      document.querySelectorAll(".menu__link").forEach(link => {
        link.classList.add("disabled");
      });
      sortChoice.textContent = "date";
    } else {
      // e le abilito se ci sono
      document.querySelectorAll(".menu__link").forEach(link => {
        link.classList.remove("disabled");
      });
    }
  }

  _getLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        // Success getting user Coords
        this._loadMap.bind(this),
        // Error getting user coords
        function () {
          alert(`Can't get your current position`);
        }
      );
    } else alert("Your Browser doesn't support geolocation");
  }

  _loadMap(position) {
    const { latitude: lat, longitude: lng } = position.coords;

    // Saving the initial coords of the user
    this.#userCoords[0] = lat;
    this.#userCoords[1] = lng;

    // Creating the leaflet map
    this.#map = L.map("map").setView([lat, lng], this.#mapZoomLevel);

    L.tileLayer(
      "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
      {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: "mapbox/dark-v10",
        tileSize: 512,
        zoomOffset: -1,
        accessToken:
          "pk.eyJ1IjoiYmxhY2tib3gxMSIsImEiOiJjbDF3OGxkYWIwMzcwM2pwOHQwMXQ2OGM0In0.6KQYul7J6Vbh4edRpmgIaA",
      }
    ).addTo(this.#map);

    // Render initial marker and popup
    const myIcon = L.icon({
      iconUrl: "img/marker.png",
      iconSize: [15, 44],
      iconAnchor: [8, 8],
    });
    const marker = L.marker([lat, lng], { icon: myIcon }).addTo(this.#map);
    marker
      .bindPopup(
        L.popup({
          minWidth: 240,
          autoClose: false,
          className: "initial-popup",
        }).setContent(
          `This is your <strong>current position</strong>.<br> Click on the map to add a workout`
        )
      )
      .openPopup();

    this.#map.on("click", this._renderPopup.bind(this));
    this.#map.on("click", this._showForm);

    // Loading Workouts List and Markers from localstorage
    this.#map.whenReady(this._getLocalStorage.bind(this));

    // Setting the Menu link state based on numbers of workouts after loading data from local storage
    // If there are workouts, _checkWorkouts() will remove the disabled state from links. If there are no workouts this function will disable the links
    this._checkWorkouts();
  }

  _renderPopup(mapE) {
    // MapE è un oggetto generato da leaflet quando clicchiamo sulla mappa. Contiene tante informazioni che ci servono (tra cui le coordinate del click sulla mappa)

    // Preventing the user from showing the add-workout form and popup when the edit-form or the delete-box are active.
    if (
      formEdit.classList.contains("active") ||
      !deleteContainer.classList.contains("delete-confirmation--hidden")
    )
      return;

    this.#mapEvent = mapE;
    // console.log(this.#mapEvent);

    const { lat, lng } = mapE.latlng;

    const popup = L.popup()
      .setLatLng([lat, lng])
      .setContent("Add a workout here.")
      .openOn(this.#map);
  }

  _showForm() {
    // Preventing the user from showing the add-workout form and popup when the edit-form or the delete-box are active.
    if (
      formEdit.classList.contains("active") ||
      !deleteContainer.classList.contains("delete-confirmation--hidden")
    )
      return;

    form.classList.remove("hidden");
    workoutDistance.focus();
  }

  _hideForm() {
    workoutDistance.value =
      workoutDuration.value =
      workoutCadence.value =
      workoutElevation.value =
        "";

    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 500);
  }

  _newWorkout(e) {
    e.preventDefault();

    const checkNumbers = function (...inputs) {
      return inputs.every(input => Number.isFinite(input));
    };
    const allPositive = function (...inputs) {
      return inputs.every(input => input > 0);
    };

    // User's click coords
    const { lat, lng } = this.#mapEvent.latlng;
    let city, country;
    // Reverse Geocoding
    fetch(
      `https://geocode.xyz/${lat},${lng}?geoit=json&auth=707564869809607284636x34394`
    )
      .then(res => {
        // console.log(res);
        if (!res.ok)
          throw new Error(`Can't retrieve workout city and country data`);
        return res.json();
      })
      .then(data => {
        console.log(data);
        city = data.city;
        country = data.country;
      })
      .catch(err => alert(err.message))
      .finally(() => {
        // Checking the form values
        const type = workoutType.value;
        const distance = +workoutDistance.value;
        const duration = +workoutDuration.value;
        let workout;

        if (type === "running") {
          const cadence = +workoutCadence.value;

          if (
            !checkNumbers(distance, duration, cadence) ||
            !allPositive(distance, duration, cadence)
          ) {
            formError.classList.remove("hidden");
            return;
          }

          workout = new Running(
            [lat, lng],
            distance,
            duration,
            city,
            country,
            cadence
          );
        }

        if (type === "cycling") {
          const elevation = +workoutElevation.value;

          if (
            !checkNumbers(distance, duration, elevation) ||
            !allPositive(distance, duration)
          ) {
            formError.classList.remove("hidden");
            return;
          }

          workout = new Cycling(
            [lat, lng],
            distance,
            duration,
            city,
            country,
            elevation
          );
        }

        formError.style.display = "none";
        formError.classList.add("hidden");
        setTimeout(() => (formError.style.display = "flex"), 500);

        this.#workouts.push(workout);
        console.log(this.#workouts);

        this._hideForm();

        this._renderWorkoutMarker(workout);

        this._renderWorkoutList(workout);

        // Remove the disabled class from links
        this._checkWorkouts();

        this._setLocalStorage();
      });
  }

  _renderWorkoutMarker(
    workout,
    autoPan = true,
    newMarker = true,
    editMarker = false
  ) {
    const myIcon = L.icon({
      iconUrl: "img/marker.png",
      iconSize: [15, 44],
      iconAnchor: [8, 8],
    });
    const marker = L.marker(workout.coords, { icon: myIcon }).addTo(this.#map);
    // console.log(marker);
    const popup = L.popup({
      minWidth: 200,
      autoClose: false,
      closeOnClick: false,
      autoPan: autoPan,
      className: `${workout.type}-popup`,
    }).setContent(
      `${workout.type === "running" ? "🏃‍♀️" : "🚴‍♂️"} ${workout.description}`
    );
    marker.bindPopup(popup).openPopup();

    if (newMarker) this.#workoutMarkers.push(marker);

    if (editMarker) {
      const markerIndex = this.#workoutMarkers.findIndex(marker => {
        return (
          marker._latlng.lat === workout.coords[0] &&
          marker._latlng.lng === workout.coords[1]
        );
      });

      // Deleting the old marker from UI (from the map)
      this.#map.removeLayer(this.#workoutMarkers[markerIndex]);

      // Replacing the old marker with the new one in the #workoutMarkers array
      this.#workoutMarkers.splice(markerIndex, 1, marker);
      // console.log(this.#workoutMarkers);
    }
  }

  _renderWorkoutList(workout, adding = true, editing = false) {
    const html = `
    <div class="workout workout--${workout.type}${
      editing ? " editing" : ""
    }" data-id="${workout.id}">
      <h4 class="workout__location">
        <svg class="workout__location-icon">
          <use xlink:href="img/sprite.svg#icon-location-pin"></use>
        </svg>
        ${workout.city ? workout.city : "(unaveilable)"}, ${
      workout.country ? workout.country : "(unaveilable)"
    }
      </h4>
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon workout__icon--type">${
          workout.type === "running" ? "🏃‍♀️" : "🚴‍♂️"
        }</span>
        <span class="workout__value workout__value--distance">${
          workout.distance
        }</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value workout__value--duration">${
          workout.duration
        }</span>
        <span class="workout__unit">min</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value workout__value--paceSpeed">${
          workout.type === "running"
            ? workout.pace.toFixed(1)
            : workout.speed.toFixed(1)
        }</span>
        <span class="workout__unit workout__unit--paceSpeed">${
          workout.type === "running" ? "min/km" : "km/h"
        }</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon workout__icon--cadenceElevation">${
          workout.type === "running" ? "🦶🏼" : "⛰"
        }</span>
        <span class="workout__value workout__value--cadenceElevation">${
          workout.type === "running" ? workout.cadence : workout.elevationGain
        }</span>
        <span class="workout__unit workout__unit--cadenceElevation">${
          workout.type === "running" ? "spm" : "m"
        }</span>
      </div>
      <div class="workout__menu">
        <svg class="workout__menu-trigger workout__menu-icons">
          <use
            xlink:href="img/sprite.svg#icon-dots-three-horizontal"
          ></use>
        </svg>
        <ul class="workout__menu-options workout__menu-options--hidden">
          <li>
            <a
              class="workout__menu-option workout__menu-option--edit"
              href="#"
            >
              <svg class="workout__menu-icons">
                <use xlink:href="img/sprite.svg#icon-new-message"></use>
              </svg>
              Edit Workout
            </a>
          </li>
          <li>
            <a
              class="workout__menu-option workout__menu-option--delete"
              href="#"
            >
              <svg class="workout__menu-icons">
                <use xlink:href="img/sprite.svg#icon-cross"></use>
              </svg>
              Delete Workout
            </a>
          </li>
        </ul>
      </div>    
    </div>`;

    if (adding) {
      workoutContainer.insertAdjacentHTML("afterbegin", html);
      // console.log(this.#workouts);
    }

    if (editing) {
      // Deleting the old workout and inserting the new one in the same position
      const currentWorkout = document.querySelector(
        `.workout[data-id="${workout.id}"]`
      );

      currentWorkout.style.display = "none";
      currentWorkout.insertAdjacentHTML("afterend", html);
      currentWorkout.remove();
    }
  }

  _toggleElevationField(cadenceField, elevationField) {
    cadenceField
      .closest(".form__group")
      .classList.toggle("form__group--hidden");

    elevationField
      .closest(".form__group")
      .classList.toggle("form__group--hidden");
  }

  _handleClick(e) {
    // Ad ogni click la prima operazione è chiudere tutti i menu aperti (sort e workout)
    this._closeAllMenus();

    // Ora devo flitrare i click in modo da catturare solo click sui link del menu principale (show, delete e sort) e quelli sul workout-menu. Quindi se non clicco su nessuno di questi link oppure se c'è già un edit-form attivo oppure un delete-confirmation attivo esco dall'intera funzione --> Infatti quando sono attivi un edit-form o un delete-box voglio che l'utente si concentri su di essi senza poter cliccare altrove e creare confusione (ad esmpio aprendo altri menu o mostrando il form per aggiungere il workout)
    // Guard Clause
    if (
      (!e.target.closest(".workout__menu") &&
        !e.target.closest(".menu__option")) ||
      formEdit.classList.contains("active") ||
      !deleteContainer.classList.contains("delete-confirmation--hidden")
    )
      return;

    // rimuovo la classe active dai link del menu principale. Verrà aggiunta al link su cui clicco
    document
      .querySelectorAll(".menu__link.active")
      .forEach(link => link.classList.remove("active"));

    // Click per aprire il workout menu
    if (e.target.closest(".workout__menu")) {
      // Showing the menu
      e.target
        .closest(".workout__menu")
        .querySelector(".workout__menu-options")
        .classList.remove("workout__menu-options--hidden");

      // Moving the map automatically on the marker
      this._moveToPopup(e);

      // Edit workout
      if (e.target.closest(".workout__menu-option--edit")) {
        e.preventDefault();
        this._showEditForm(e);
      }

      // Delete Workout
      if (e.target.closest(".workout__menu-option--delete")) {
        e.preventDefault();
        this._deleteWorkout(e);
      }
    }

    // Click sul menu principale (show all / delete all / sort)
    if (e.target.closest(".menu__option")) {
      // Se i link sono disabilitati esci dalla funzione
      const disabledLink = e.target.querySelector(".disabled");
      if (disabledLink) return;

      // Adding active class to the link
      // Checking if the click is on main menu items or sort menu items
      if (e.target.closest(".menu__link"))
        e.target.closest(".menu__link").classList.add("active");

      // Show All workout markers on the map
      if (e.target.closest(".menu__option--show")) {
        e.preventDefault();

        const group = new L.featureGroup(this.#workoutMarkers);
        this.#map.fitBounds(group.getBounds());
      }

      // Showing the Delete confirmation box
      // The actual deleting process of all workouts will be handled by another function
      if (e.target.closest(".menu__option--delete")) {
        e.preventDefault();

        // Showing the confirmation box
        document
          .querySelector(".delete-confirmation")
          .classList.remove("delete-confirmation--hidden");
      }

      // Sorting
      if (e.target.closest(".menu__option--sort")) {
        e.preventDefault();

        // Showing the sorting menu
        document
          .querySelector(".menu__menu-sort")
          .classList.remove("menu__menu-sort--hidden");

        // Adding the active class to the main menu sort link
        e.target
          .closest(".menu__option--sort")
          .querySelector(".menu__link")
          .classList.add("active");

        // Sorting by date (default)
        if (e.target.closest(".menu__menu-sort-option--date")) {
          e.preventDefault();

          // Hiding the sort menu
          document
            .querySelector(".menu__menu-sort")
            .classList.add("menu__menu-sort--hidden");

          // Doing the sort (date is default, no need to pass the string 'date') to _sortWorkouts()
          this._sortWorkouts();
        }

        // Sorting by distance
        if (e.target.closest(".menu__menu-sort-option--distance")) {
          e.preventDefault();

          // Hiding the sort menu
          document
            .querySelector(".menu__menu-sort")
            .classList.add("menu__menu-sort--hidden");

          // Doing the sort
          this._sortWorkouts("distance");
        }

        // Sorting by duration
        if (e.target.closest(".menu__menu-sort-option--duration")) {
          e.preventDefault();

          // Hiding the sort menu
          document
            .querySelector(".menu__menu-sort")
            .classList.add("menu__menu-sort--hidden");

          // Doing the sort
          this._sortWorkouts("duration");
        }
      }
    }
  }

  _closeAllMenus() {
    document.querySelectorAll(".workout__menu-options").forEach(menu => {
      menu.classList.add("workout__menu-options--hidden");
    });
    document
      .querySelector(".menu__menu-sort")
      .classList.add("menu__menu-sort--hidden");
  }

  _moveToPopup(e) {
    const workoutId = e.target.closest(".workout").dataset.id;

    const workoutEl = this.#workouts.find(workout => workout.id === workoutId);

    this.#map.setView(workoutEl.coords, this.#mapZoomLevel, {
      animate: true,
      duration: 1,
    });
  }

  _sortWorkouts(option = "date") {
    // Changing the visual text on the sort link
    sortChoice.textContent = option;

    // 1) Emptying the workout container (except the form).
    // NOTE: Can't use workoutContainer.innerHTML = '' because the edit-form is inside the .workouts container and we don't want to delete it, so the only option is to remove directly the .workout elements and replacing with the sorted one
    document.querySelectorAll(".workout").forEach(el => el.remove());

    // 2) sorting the #workouts array by 'option' after copying and displaying on UI
    this.#workouts
      .slice()
      .sort((a, b) => {
        return a[option] - b[option];
      })
      .forEach(workout => {
        this._renderWorkoutList(workout);
      });
  }

  _deleteWorkout(e) {
    // Identification of the workout that has to be deleted
    const el = e.target.closest(".workout");

    // Delete marker from Markers UI and workoutMarkers array
    const workoutCoords = this.#workouts.find(
      workout => workout.id === el.dataset.id
    ).coords;

    const markerIndex = this.#workoutMarkers.findIndex(marker => {
      return (
        marker._latlng.lat === workoutCoords[0] &&
        marker._latlng.lng === workoutCoords[1]
      );
    });
    this.#map.removeLayer(this.#workoutMarkers[markerIndex]); // Delete from UI
    this.#workoutMarkers.splice(markerIndex, 1); // Delete from workouMarkers Array

    // Delete workout from workout Arrays
    const index = this.#workouts.findIndex(
      workout => workout.id === el.dataset.id
    );
    this.#workouts.splice(index, 1);

    // Delete workout from list in UI
    el.remove();

    // Checking if the workout array is empty or not, If it is, this function will disable all menu links
    this._checkWorkouts();

    // Updating localStorage or resetting it if there are no more workouts
    if (this.#workouts.length !== 0) {
      this._setLocalStorage(); // Will overwrite the previous 'workout' item
    } else {
      localStorage.removeItem("workouts");

      // Also, if we delete the last workout, the map should be positioned on user's initial coords
      this.#map.setView(this.#userCoords, this.#mapZoomLevel, {
        animate: true,
        duration: 1.2,
      });
    }
  }

  _showEditForm(e) {
    const workoutListEl = e.target.closest(".workout");

    // Filling the edit-form with current workout values and cadence/elevation fields
    const workout = this.#workouts.find(
      workout => workout.id === workoutListEl.dataset.id
    );

    if (workout.type === "running") {
      workoutTypeEditForm
        .querySelectorAll("option")
        .forEach(opt => opt.removeAttribute("selected"));
      workoutTypeEditForm
        .querySelector("option[value=running]")
        .setAttribute("selected", "selected");

      workoutCadenceEditForm
        .closest(".form__group")
        .classList.remove("form__group--hidden");

      workoutElevationEditForm
        .closest(".form__group")
        .classList.add("form__group--hidden");

      workoutCadenceEditForm.value = workout.cadence;
    }

    if (workout.type === "cycling") {
      workoutTypeEditForm
        .querySelectorAll("option")
        .forEach(opt => opt.removeAttribute("selected"));
      workoutTypeEditForm
        .querySelector("option[value=cycling]")
        .setAttribute("selected", "selected");

      workoutCadenceEditForm
        .closest(".form__group")
        .classList.add("form__group--hidden");

      workoutElevationEditForm
        .closest(".form__group")
        .classList.remove("form__group--hidden");

      workoutElevationEditForm.value = workout.elevationGain;
    }

    workoutDistanceEditForm.value = workout.distance;
    workoutDurationEditForm.value = workout.duration;

    // Positioning the edit form to the same top position of the workout
    // Per far si che possa posizionare il form-edit esattamente nella stessa posizione top del workout list, devo trovare la posizione top del workout list rispetto al contenitore .workouts, per cui devo trovare la distanza che il workout-list su cui ho cliccato ha dal top del suo contenitore. Questa distanza è uguale alla distanza che il workout-list ha dal top della pagina (getboundingclientrect().top) meno (sottratto) la distanza del contenitore .workouts dal top della pagina. Quando scrolliamo il contenitore workouts dobbiamo aggiungere a quest'ultima sottrazione anche l'ammontare di scroll che abbiamo effettuato sul contenitore .workouts (scrollTop)
    formEdit.style.top = `${
      workoutListEl.getBoundingClientRect().top -
      workoutContainer.getBoundingClientRect().top +
      workoutContainer.scrollTop
    }px`;

    // Moving aside the workout list item and show the edit form
    formEdit.classList.remove("form-editing--hidden");
    workoutListEl.classList.add("editing");
    // SetTimeout is essential to obtain the visual effect of the edit-form sliding at the same time as the workout list item. Without settimeout the edit-form will appear suddenly without waiting for animation (0.3s)
    // Adding an 'active' class (only for control, no actual style inside this class) because i don't want the user to show the add-workout form and the popup when the edit-form is visible (see _showForm() and _renderPopup()).
    setTimeout(() => formEdit.classList.add("animated", "active"), 0);

    // Preventing the user from scrolling the .workout div while the edit form is visible
    workoutContainer.style.overflowY = "hidden";
  }

  _editWorkout(e) {
    // Preventing the submit (will reload the page by default)
    e.preventDefault();

    const checkNumbers = function (...inputs) {
      return inputs.every(input => Number.isFinite(input));
    };
    const allPositive = function (...inputs) {
      return inputs.every(input => input > 0);
    };

    // Traversing the DOM to Select the workout element we are currently modifying
    const workoutItem = e.target.closest(".workouts").querySelector(".editing");
    const workoutId = workoutItem.dataset.id;
    // Finding the workout in this.#workouts array
    const workout = this.#workouts.find(workout => workout.id === workoutId);

    // Collecting form data
    const type = workoutTypeEditForm.value;
    const distance = +workoutDistanceEditForm.value;
    const duration = +workoutDurationEditForm.value;

    // If the user keep the same type of workout after the modification, we have to simply replace the old values in the #workout array with the new ones, but if the user change the type we have to delete the old workout type from the array and push the new workout type (new object) in the same position because the two object classes are different (for example Running has pace and Cycling has speed). Then if the user change type we also need to change the description and the color in the popup and the color (and info) of the workout list item
    // SCENARIO 1: User keeps Running workout
    if (type === "running" && workout.type === "running") {
      const cadence = +workoutCadenceEditForm.value;

      // Checking the form values / throwing error feedback, modify the data
      if (
        !checkNumbers(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        formEditError.classList.remove("hidden");
        return;
      }

      // Updating the values of the workout object
      this._updateWorkoutObj(workout, distance, duration, cadence, false);

      // Updating the values in the UI (workout list item)
      this._updateWorkout(workoutItem, distance, duration, cadence, false);

      // Updating the UI (visual effect removing the form)
      this._cancelEdit(e);
    }

    // SCENARIO 2: User keeps Cycling workout
    if (type === "cycling" && workout.type === "cycling") {
      const elevation = +workoutElevationEditForm.value;

      if (
        !checkNumbers(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        formEditError.classList.remove("hidden");
        return;
      }

      // Updating the values of the workout object
      this._updateWorkoutObj(workout, distance, duration, false, elevation);

      // Updating the values in the UI (workout list item)
      this._updateWorkout(workoutItem, distance, duration, false, elevation);

      // Updating the UI (visual effect removing the form)
      this._cancelEdit(e);
    }

    // SCENARIO 3: User switch from running to cycling
    if (type === "cycling" && workout.type === "running") {
      const elevation = +workoutElevationEditForm.value;

      if (
        !checkNumbers(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        formEditError.classList.remove("hidden");
        return;
      }

      // Creating a new workout with same coords as old and new values coming from edit-form
      const newWorkout = new Cycling(
        workout.coords,
        distance,
        duration,
        elevation
      );
      // Keeping the date and id from previous workout
      newWorkout.date = workout.date;
      newWorkout.id = workout.id;

      // Replacing the old workout with the new workout in #workouts array
      const workoutIndex = this.#workouts.findIndex(
        workout => workout.id === workoutId
      );
      this.#workouts.splice(workoutIndex, 1, newWorkout);

      // Replacing the old workout List item with the new of the new type
      this._renderWorkoutList(newWorkout, false, true);

      // Updating the marker (markers array and marker element)
      this._renderWorkoutMarker(newWorkout, true, false, true);

      // Updating the UI (visual effect removing the form)
      setTimeout(() => this._cancelEdit(e), 0);
    }

    // SCENARIO 4: User switch from cycling to running
    if (type === "running" && workout.type === "cycling") {
      const cadence = +workoutCadenceEditForm.value;

      if (
        !checkNumbers(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        formEditError.classList.remove("hidden");
        return;
      }

      // Creating a new workout with same coords as old and new values coming from edit-form
      const newWorkout = new Running(
        workout.coords,
        distance,
        duration,
        cadence
      );
      // Keeping the date and id from previous workout
      newWorkout.date = workout.date;
      newWorkout.id = workout.id;

      // Replacing the old workout with the new workout in #workouts array
      const workoutIndex = this.#workouts.findIndex(
        workout => workout.id === workoutId
      );
      this.#workouts.splice(workoutIndex, 1, newWorkout);

      // Replacing the old workout List item with the new of the new type
      this._renderWorkoutList(newWorkout, false, true);

      // Updating the marker (markers array and marker element)
      this._renderWorkoutMarker(newWorkout, true, false, true);

      // Updating the UI (visual effect removing the form)
      setTimeout(() => this._cancelEdit(e), 0);
    }

    // Updating Local Storage
    this._setLocalStorage();
  }

  _updateWorkoutObj(wk, distance, duration, cadence, elevation) {
    wk.distance = distance;
    wk.duration = duration;
    wk.cadence ? (wk.cadence = cadence) : (wk.elevationGain = elevation);
    wk.pace
      ? (wk.pace = duration / distance)
      : (wk.speed = distance / (duration / 60));
  }

  _updateWorkout(wkItem, distance, duration, cadence, elevation) {
    wkItem.querySelector(".workout__value--distance").textContent = distance;
    wkItem.querySelector(".workout__value--duration").textContent = duration;

    if (cadence) {
      wkItem.querySelector(".workout__value--paceSpeed").textContent = (
        duration / distance
      ).toFixed(1);
      wkItem.querySelector(".workout__value--cadenceElevation").textContent =
        cadence;
    }

    if (elevation) {
      wkItem.querySelector(".workout__value--paceSpeed").textContent = (
        distance /
        (duration / 60)
      ).toFixed(1);
      wkItem.querySelector(".workout__value--cadenceElevation").textContent =
        elevation;
    }
  }

  _cancelEdit(e) {
    formEdit.classList.remove("animated", "active");

    // Find the current .editing workout and removing the class .editing to show it again
    e.target
      .closest(".workouts")
      .querySelector(".editing")
      .classList.remove("editing");

    // Adding the class hidden class to the edit-form only after the animation is complete to keep the sliding effect
    // 300ms is the transition time of .workout
    setTimeout(() => {
      formEdit.classList.add("form-editing--hidden");
    }, 350);

    workoutContainer.style.overflowY = "scroll";
  }

  _dismissError(e) {
    e.target.closest(".form-control").classList.add("hidden");
  }

  _handleDelete(e) {
    // If the user clicks outside of the buttons exit this function
    const btn = e.target.closest(".delete-confirmation__btn");
    if (!btn) return;

    // Confirm deleting --> delete all workouts
    if (btn.classList.contains("delete-confirmation__btn--yes")) {
      // Closing the delete box  and removing the active class from the link
      deleteContainer.classList.add("delete-confirmation--hidden");
      document.querySelector(".menu__link.active").classList.remove("active");

      // Delete all workouts from workouts array
      this.#workouts.splice(0);

      // Deleting the ui elements AFTER delete box has closed so i use a timeout
      // Using an external function for binding the this keyword insisde seTimeout()
      const deleteFn = function () {
        // Delete all workouts from List (UI)
        document
          .querySelectorAll(".workout")
          .forEach(workoutEl => workoutEl.remove());

        // Delete all markers from Map (UI)
        this.#workoutMarkers.forEach(marker => {
          this.#map.removeLayer(marker);
        });

        // Delete all markers from workoutMarkers array (needs to happen after deleting from UI because if it happen before it the #workoutMarkers array will be empty)
        this.#workoutMarkers.splice(0);

        // Positioning the map on the current location
        this.#map.setView(this.#userCoords, this.#mapZoomLevel, {
          animate: true,
          duration: 1.2,
        });

        // Since we deleted all workouts the menu links should be disabled
        this._checkWorkouts();
      }.bind(this);

      setTimeout(deleteFn, 600);

      // Reset local Storage
      localStorage.removeItem("workouts");
    }

    // Cancel
    if (btn.classList.contains("delete-confirmation__btn--no")) {
      deleteContainer.classList.add("delete-confirmation--hidden");
      document.querySelector(".menu__link.active").classList.remove("active");
    }
  }

  _setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));

    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach(workout => {
      this._renderWorkoutList(workout);
      this._renderWorkoutMarker(workout, false); // auto pan false
    });
  }

  reset() {
    localStorage.removeItem("workouts");
    location.reload();
  }
}
const app = new App();
