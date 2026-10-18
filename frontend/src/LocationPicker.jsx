import React, { useEffect, useRef, useState } from "react";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
let mapsPromise;

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!apiKey) return Promise.reject(new Error("Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env.local to enable Google Maps."));
  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-agro-google-maps="true"]');
      const script = existing || document.createElement("script");
      const loaded = () => window.google?.maps
        ? resolve(window.google.maps)
        : reject(new Error("Google Maps loaded without its Maps JavaScript API."));
      const failed = () => {
        mapsPromise = null;
        reject(new Error("Google Maps could not load. Check the API key, billing, and enabled APIs."));
      };
      script.addEventListener("load", loaded, { once: true });
      script.addEventListener("error", failed, { once: true });
      if (!existing) {
        script.dataset.agroGoogleMaps = "true";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
  }
  return mapsPromise;
}

export default function LocationPicker({ location = "", latitude, longitude, onChange, label = "Farm location" }) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState("");
  const [mapsAvailable, setMapsAvailable] = useState(false);
  const geocodeSequence = useRef(0);
  const hasCoordinates = latitude != null && latitude !== "" &&
    longitude != null && longitude !== "" &&
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let active = true;
    let resizeObserver;
    setStatus(apiKey ? "Loading Google Maps..." : "Add a Google Maps browser key to enable the map.");
    loadGoogleMaps().then(maps => {
      if (!active || !mapElement.current) return;
      const hasPoint = Number.isFinite(Number(latitude)) && latitude !== "" &&
        Number.isFinite(Number(longitude)) && longitude !== "";
      const point = hasPoint ? { lat: Number(latitude), lng: Number(longitude) } : { lat: 20, lng: 0 };
      const map = new maps.Map(mapElement.current, {
        center: point,
        zoom: hasPoint ? 13 : 2,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
      });
      mapRef.current = map;
      geocoderRef.current = new maps.Geocoder();
      markerRef.current = new maps.Marker({ map, position: point, draggable: true, visible: hasPoint });
      map.addListener("click", event => {
        if (!event.latLng) return;
        updatePoint(event.latLng.toJSON(), true);
      });
      markerRef.current.addListener("dragend", event => {
        if (event.latLng) updatePoint(event.latLng.toJSON(), true);
      });
      resizeObserver = new ResizeObserver(() => {
        if (!mapElement.current?.offsetWidth) return;
        const center = map.getCenter();
        maps.event.trigger(map, "resize");
        if (center) map.setCenter(center);
      });
      resizeObserver.observe(mapElement.current);
      setMapsAvailable(true);
      if (!hasPoint) setStatus("Search for a place or click the map to choose your farm.");
    }).catch(error => {
      if (active) setStatus(error.message);
    });
    return () => {
      active = false;
      resizeObserver?.disconnect();
    };
  }, []);

  function updatePoint(point, reverseGeocode) {
    markerRef.current?.setPosition(point);
    markerRef.current?.setVisible(true);
    mapRef.current?.panTo(point);
    onChangeRef.current({
      latitude: String(point.lat),
      longitude: String(point.lng)
    });
    setStatus(`Selected coordinates: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
    if (!reverseGeocode || !geocoderRef.current) return;

    const sequence = ++geocodeSequence.current;
    geocoderRef.current.geocode({ location: point }).then(({ results }) => {
      if (sequence !== geocodeSequence.current) return;
      if (results?.[0]?.formatted_address) {
        onChangeRef.current({
          location: results[0].formatted_address,
          latitude: String(point.lat),
          longitude: String(point.lng)
        });
        setStatus(`Selected: ${results[0].formatted_address}`);
      }
    }).catch(() => {
      if (sequence === geocodeSequence.current) {
        setStatus("Coordinates saved. Google could not find a readable address for this point.");
      }
    });
  }

  async function searchLocation() {
    if (!location.trim() || !geocoderRef.current) return;
    setStatus("Searching for this location...");
    const sequence = ++geocodeSequence.current;
    try {
      const { results } = await geocoderRef.current.geocode({ address: location });
      if (sequence !== geocodeSequence.current) return;
      const result = results?.[0];
      if (!result) {
        setStatus("No matching place found. Try a more specific address or select the map.");
        return;
      }
      const point = result.geometry.location.toJSON();
      mapRef.current?.setZoom(13);
      updatePoint(point, false);
      onChangeRef.current({
        location: result.formatted_address,
        latitude: String(point.lat),
        longitude: String(point.lng)
      });
      setStatus(`Selected: ${result.formatted_address}`);
    } catch {
      setStatus("Google Maps could not find that location. Check the address or select the map.");
    }
  }

  return (
    <div className="location-picker full-row">
      <label>{label}
        <input
          value={location}
          onChange={event => onChange({
            location: event.target.value,
            latitude: "",
            longitude: ""
          })}
          placeholder="Search an address, town, region, or country"
        />
      </label>
      {mapsAvailable && <button className="secondary location-search" type="button" onClick={searchLocation}>
        Find location on map
      </button>}
      <div className={`location-map ${mapsAvailable ? "" : "location-map-placeholder"}`} ref={mapElement} aria-label="Google Map location picker">
        {!mapsAvailable && <span>{!apiKey ? "Google Map will appear after setup" : status.includes("could not load") ? "Google Map could not load" : "Loading Google Map..."}</span>}
      </div>
      <p className="tiny location-status" role="status">
        {status}
        {hasCoordinates && ` · ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`}
      </p>
      {!apiKey && <p className="tiny">Add a Google Maps browser key to enable map selection. You can still enter an address above.</p>}
      {!apiKey && <div className="location-coordinate-fields">
        <label>Latitude<input type="number" min="-90" max="90" step="any" value={latitude ?? ""} onChange={event => onChange({ latitude: event.target.value })} /></label>
        <label>Longitude<input type="number" min="-180" max="180" step="any" value={longitude ?? ""} onChange={event => onChange({ longitude: event.target.value })} /></label>
      </div>}
    </div>
  );
}
