// Map MCP Client
let map;
let mapboxToken;
let currentRequestId;
let conversationHistory = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Fetch Mapbox token from the server
    const configResponse = await fetch('/api/mapbox-config');
    const config = await configResponse.json();
    mapboxToken = config.mapboxToken;
    
    // Get DOM elements
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');
    
    // Initialize map with a default view
    initializeMap();
    
    // Set up event listeners
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = messageInput.value.trim();
      if (!message) return;
      
      // Clear input
      messageInput.value = '';
      
      // Add user message to UI
      addMessage(message, 'user');
      
      // Generate a request ID
      currentRequestId = generateRequestId();
      
      // Save to conversation history
      conversationHistory.push({
        role: 'user',
        content: message
      });
      
      // Add loading indicator
      const loadingIndicator = addLoadingIndicator();
      
      try {
        // Send request to MCP server
        const response = await fetch('/api/mcp/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentRequestId,
            message: message,
            model: 'gpt-4o',
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to get response from server');
        }
        
        const data = await response.json();
        
        // Handle tool calls if any
        if (data.tool_calls && data.tool_calls.length > 0) {
          const toolResults = await processToolCalls(data.tool_calls);
          
          // Send tool results back to MCP server
          const resultsResponse = await fetch('/api/mcp/tool-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestId: currentRequestId,
              results: toolResults,
              originalMessage: message,
              model: 'gpt-4o',
            })
          });
          
          if (!resultsResponse.ok) {
            throw new Error('Failed to process tool results');
          }
          
          const finalResponse = await resultsResponse.json();
          
          // Display the final message
          removeLoadingIndicator(loadingIndicator);
          addMessage(finalResponse.message, 'bot');
          
          // Save to conversation history
          conversationHistory.push({
            role: 'assistant',
            content: finalResponse.message
          });
        } else {
          // Display direct response (no tool calls)
          removeLoadingIndicator(loadingIndicator);
          addMessage(data.message, 'bot');
          
          // Save to conversation history
          conversationHistory.push({
            role: 'assistant',
            content: data.message
          });
        }
      } catch (error) {
        console.error('Error:', error);
        removeLoadingIndicator(loadingIndicator);
        addMessage('Sorry, an error occurred while processing your request.', 'bot');
      }
    });
  } catch (error) {
    console.error('Initialization error:', error);
    document.body.innerHTML = '<div class="p-4 text-red-600">Failed to initialize the application. Please check the console for details.</div>';
  }
});

// Initialize Mapbox map
function initializeMap() {
  console.log('Initializing map with token:', mapboxToken);

  if (!mapboxToken) {
    console.error('Mapbox token not found');
    document.getElementById('map-container').innerHTML = '<div style="padding: 20px; color: red;">Error: Mapbox token not found</div>';
    return;
  }

  try {
    console.log('Setting Mapbox access token...');
    mapboxgl.accessToken = mapboxToken;

    console.log('Creating map instance...');
    const mapContainer = document.getElementById('map-container');
    console.log('Map container:', mapContainer);

    map = new mapboxgl.Map({
      container: 'map-container',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.5, 40], // Default to New York
      zoom: 9
    });

    console.log('Map instance created:', map);

    // Add event listeners for debugging
    map.on('load', () => {
      console.log('Map loaded successfully');
    });

    map.on('error', (e) => {
      console.error('Map error:', e);
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add geocoder (search) control
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true
      })
    );

    console.log('Map initialization completed');
  } catch (error) {
    console.error('Error initializing map:', error);
    document.getElementById('map-container').innerHTML =
      `<div style="padding: 20px; color: red;">Error initializing map: ${error.message}</div>`;
  }
}

// Process MCP tool calls
async function processToolCalls(toolCalls) {
  return Promise.all(toolCalls.map(async (call) => {
    try {
      let result;
      
      // Handle different map tool calls
      switch (call.name) {
        case 'map_initialize':
          result = handleMapInitialize(call.input);
          break;
        case 'map_move':
          result = handleMapMove(call.input);
          break;
        case 'map_add_layer':
          result = handleMapAddLayer(call.input);
          break;
        case 'map_remove_layer':
          result = handleMapRemoveLayer(call.input);
          break;
        case 'map_get_features':
          result = await handleMapGetFeatures(call.input);
          break;
        case 'map_search':
          result = await handleMapSearch(call.input);
          break;
        case 'map_get_bounds':
          result = handleMapGetBounds(call.input);
          break;
        case 'arcgis_parcel_search':
          result = await handleArcGISParcelSearch(call.input);
          break;
        case 'arcgis_lead_search':
          result = await handleArcGISLeadSearch(call.input);
          break;
        case 'arcgis_parcel_query':
          result = await handleArcGISParcelQuery(call.input);
          break;
        case 'arcgis_lead_query':
          result = await handleArcGISLeadQuery(call.input);
          break;
        case 'map_add_polygon':
          result = await handleMapAddPolygon(call.input);
          break;
        case 'arcgis_bbox_query':
          result = await handleArcGISBboxQuery(call.input);
          break;
        case 'arcgis_radius_query':
          result = await handleArcGISRadiusQuery(call.input);
          break;
        case 'arcgis_layer_search':
          result = await handleArcGISLayerSearch(call.input);
          break;
        case 'arcgis_point_query':
          result = await handleArcGISPointQuery(call.input);
          break;
        case 'arcgis_data_visualize':
          result = await handleArcGISDataVisualize(call.input);
          break;
        case 'map_clear_layers':
          result = handleMapClearLayers(call.input);
          break;
        default:
          throw new Error(`Unknown tool: ${call.name}`);
      }
      
      return {
        id: call.id,
        output: result
      };
    } catch (error) {
      console.error(`Error handling tool call ${call.name}:`, error);
      return {
        id: call.id,
        error: error.message
      };
    }
  }));
}

// Map tool handlers
function handleMapInitialize(input) {
  try {
    console.log('handleMapInitialize called with input:', input);
    const { center, zoom, style } = input;

    const options = {
      center,
      zoom
    };

    if (style) {
      options.style = style;
    }

    if (map) {
      // Destroy existing map instance if it exists
      console.log('Removing existing map instance');
      map.remove();
    }

    console.log('Creating new map with options:', options);

    // Make sure mapboxgl is loaded and token is set
    if (!mapboxgl) {
      console.error('mapboxgl is not loaded');
      throw new Error('mapboxgl is not loaded');
    }

    if (!mapboxToken) {
      console.error('Mapbox token not found');
      throw new Error('Mapbox token not found');
    }

    mapboxgl.accessToken = mapboxToken;

    // Get the map container element
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) {
      console.error('Map container element not found');
      throw new Error('Map container element not found');
    }

    console.log('Map container element:', mapContainer);

    // Create new map with the specified options
    map = new mapboxgl.Map({
      container: 'map-container',
      ...options,
      style: style || 'mapbox://styles/mapbox/streets-v12'
    });

    // Add event listeners for debugging
    map.on('load', () => {
      console.log('Map loaded successfully');
    });

    map.on('error', (e) => {
      console.error('Map error:', e);
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    console.log('Map initialization completed');

    return {
      success: true,
      message: 'Map initialized successfully'
    };
  } catch (error) {
    console.error('Map initialization error:', error);
    // Display error message in the map container
    document.getElementById('map-container').innerHTML =
      `<div style="padding: 20px; color: red;">Error initializing map: ${error.message}</div>`;
    throw new Error('Failed to initialize map: ' + error.message);
  }
}

function handleMapMove(input) {
  try {
    const { center, zoom, bearing, pitch, animate, duration } = input;
    
    if (!map) {
      throw new Error('Map not initialized');
    }
    
    const options = {
      center,
    };
    
    if (zoom !== undefined) options.zoom = zoom;
    if (bearing !== undefined) options.bearing = bearing;
    if (pitch !== undefined) options.pitch = pitch;
    
    if (animate) {
      options.essential = true;
      if (duration) {
        options.duration = duration;
      }
      map.flyTo(options);
    } else {
      map.jumpTo(options);
    }
    
    return {
      success: true,
      message: 'Map moved successfully',
      location: {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      }
    };
  } catch (error) {
    console.error('Map move error:', error);
    throw new Error('Failed to move map: ' + error.message);
  }
}

function handleMapAddLayer(input) {
  try {
    const { id, type, source, paint, layout } = input;
    
    if (!map) {
      throw new Error('Map not initialized');
    }
    
    // Check if the layer already exists
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
    
    // Check if we need to add a source
    if (typeof source !== 'string' && source.type) {
      const sourceId = id + '-source';
      
      // Remove source if it already exists
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      
      // Add the source
      map.addSource(sourceId, source);
      
      // Create the layer
      const layer = {
        id,
        type,
        source: sourceId
      };
      
      if (paint) layer.paint = paint;
      if (layout) layer.layout = layout;
      
      map.addLayer(layer);
    } else {
      // Create the layer with existing source
      const layer = {
        id,
        type,
        source
      };
      
      if (paint) layer.paint = paint;
      if (layout) layer.layout = layout;
      
      map.addLayer(layer);
    }
    
    return {
      success: true,
      message: `Layer '${id}' added successfully`
    };
  } catch (error) {
    console.error('Add layer error:', error);
    throw new Error('Failed to add layer: ' + error.message);
  }
}

function handleMapRemoveLayer(input) {
  try {
    const { id } = input;
    
    if (!map) {
      throw new Error('Map not initialized');
    }
    
    if (map.getLayer(id)) {
      map.removeLayer(id);
      
      // Also remove the source if it has the same ID + '-source'
      const sourceId = id + '-source';
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      
      return {
        success: true,
        message: `Layer '${id}' removed successfully`
      };
    } else {
      return {
        success: false,
        message: `Layer '${id}' not found`
      };
    }
  } catch (error) {
    console.error('Remove layer error:', error);
    throw new Error('Failed to remove layer: ' + error.message);
  }
}

async function handleMapGetFeatures(input) {
  try {
    const { point, layers } = input;

    if (!map) {
      throw new Error('Map not initialized');
    }

    // Convert geographic coordinates to pixel coordinates
    const pixelPoint = map.project(point);

    // Query features at point
    const features = map.queryRenderedFeatures(pixelPoint, {
      layers: layers || undefined
    });

    return {
      success: true,
      features: features.map(f => ({
        id: f.id,
        type: f.type,
        source: f.source,
        sourceLayer: f.sourceLayer,
        properties: f.properties
      }))
    };
  } catch (error) {
    console.error('Get features error:', error);
    throw new Error('Failed to get features: ' + error.message);
  }
}

// Handle map search (geocoding)
async function handleMapSearch(input) {
  try {
    console.log('Searching for location:', input.query);

    if (!map) {
      throw new Error('Map not initialized');
    }

    if (!mapboxToken) {
      throw new Error('Mapbox token not found');
    }

    // Use Mapbox Geocoding API
    const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input.query)}.json?access_token=${mapboxToken}&limit=1`;

    const response = await fetch(geocodingUrl);
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Geocoding response:', data);

    if (!data.features || data.features.length === 0) {
      return {
        success: false,
        message: `Location "${input.query}" not found`
      };
    }

    // Get the coordinates of the first result
    const feature = data.features[0];
    const [lng, lat] = feature.center;

    // Create options for flying to the location
    const options = {
      center: [lng, lat],
      zoom: input.zoom || 12,
      essential: true
    };

    if (input.animate !== false) {
      const duration = input.duration || 2000;
      map.flyTo({
        ...options,
        duration: duration / 1000 // Mapbox uses seconds, not milliseconds
      });
    } else {
      map.jumpTo(options);
    }

    return {
      success: true,
      location: {
        name: feature.place_name,
        coordinates: feature.center,
        bbox: feature.bbox,
        zoom: input.zoom || 12
      }
    };
  } catch (error) {
    console.error('Map search error:', error);
    throw new Error('Failed to search location: ' + error.message);
  }
}

// Handle getting current map bounds
function handleMapGetBounds(input) {
  try {
    console.log('Getting map bounds:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { format = 'bbox', padding = 0 } = input;
    
    // Get current map bounds
    const bounds = map.getBounds();
    const currentZoom = map.getZoom();
    const center = map.getCenter();

    // Apply padding if specified
    let adjustedBounds = bounds;
    if (padding > 0) {
      // Convert padding from pixels to degrees (rough approximation)
      const pixelToDegrees = 360 / Math.pow(2, currentZoom + 8);
      const paddingDegrees = padding * pixelToDegrees;
      
      adjustedBounds = new mapboxgl.LngLatBounds([
        bounds.getWest() - paddingDegrees,
        bounds.getSouth() - paddingDegrees
      ], [
        bounds.getEast() + paddingDegrees,
        bounds.getNorth() + paddingDegrees
      ]);
    }

    // Format the bounds based on requested format
    let result;
    
    switch (format) {
      case 'bbox':
        result = {
          bounds: [
            adjustedBounds.getWest(),
            adjustedBounds.getSouth(),
            adjustedBounds.getEast(),
            adjustedBounds.getNorth()
          ],
          format: 'bbox'
        };
        break;
        
      case 'geojson':
        result = {
          bounds: {
            type: 'Feature',
            properties: {
              name: 'Current Map Bounds'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [adjustedBounds.getWest(), adjustedBounds.getSouth()],
                [adjustedBounds.getEast(), adjustedBounds.getSouth()],
                [adjustedBounds.getEast(), adjustedBounds.getNorth()],
                [adjustedBounds.getWest(), adjustedBounds.getNorth()],
                [adjustedBounds.getWest(), adjustedBounds.getSouth()]
              ]]
            }
          },
          format: 'geojson'
        };
        break;
        
      case 'bounds':
      default:
        result = {
          bounds: {
            west: adjustedBounds.getWest(),
            south: adjustedBounds.getSouth(),
            east: adjustedBounds.getEast(),
            north: adjustedBounds.getNorth()
          },
          format: 'bounds'
        };
        break;
    }

    return {
      success: true,
      ...result,
      center: [center.lng, center.lat],
      zoom: currentZoom,
      padding,
      area: {
        width: Math.abs(adjustedBounds.getEast() - adjustedBounds.getWest()),
        height: Math.abs(adjustedBounds.getNorth() - adjustedBounds.getSouth())
      },
      message: `Current map bounds retrieved in ${format} format`
    };

  } catch (error) {
    console.error('Get bounds error:', error);
    throw new Error('Failed to get map bounds: ' + error.message);
  }
}

// Handle ArcGIS parcel search
async function handleArcGISParcelSearch(input) {
  try {
    console.log('Searching for parcel:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { apn, county, animate } = input;

    // In a production environment, this would come from the real ArcGIS API
    // For this demo, we're using the mocked response from the server

    // Clear any existing parcel layers
    if (map.getLayer('parcel-fill')) {
      map.removeLayer('parcel-fill');
    }
    if (map.getLayer('parcel-outline')) {
      map.removeLayer('parcel-outline');
    }
    if (map.getSource('parcel-source')) {
      map.removeSource('parcel-source');
    }

    // Add the parcel to the map
    const { parcel, center, zoom } = input.response || input;

    if (parcel && parcel.geometry) {
      // Add the parcel as a source
      map.addSource('parcel-source', {
        type: 'geojson',
        data: parcel
      });

      // Add fill layer
      map.addLayer({
        id: 'parcel-fill',
        type: 'fill',
        source: 'parcel-source',
        paint: {
          'fill-color': '#3498db',
          'fill-opacity': 0.4
        }
      });

      // Add outline layer
      map.addLayer({
        id: 'parcel-outline',
        type: 'line',
        source: 'parcel-source',
        paint: {
          'line-color': '#2980b9',
          'line-width': 2
        }
      });

      // Move the map to the parcel
      if (center) {
        const options = {
          center,
          zoom: zoom || 16,
          essential: true
        };

        if (animate !== false) {
          map.flyTo(options);
        } else {
          map.jumpTo(options);
        }
      }

      // Return success with parcel info
      return {
        success: true,
        apn,
        county,
        center,
        zoom,
        properties: parcel.properties
      };
    } else {
      throw new Error('Invalid parcel data received');
    }
  } catch (error) {
    console.error('ArcGIS parcel search error:', error);
    throw new Error('Failed to search for parcel: ' + error.message);
  }
}

// Handle ArcGIS lead search
async function handleArcGISLeadSearch(input) {
  try {
    console.log('Searching for lead:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { id, county, animate } = input;

    // In a production environment, this would come from the real ArcGIS API
    // For this demo, we're using the mocked response from the server

    // Clear any existing lead layers
    if (map.getLayer('lead-circle')) {
      map.removeLayer('lead-circle');
    }
    if (map.getLayer('lead-label')) {
      map.removeLayer('lead-label');
    }
    if (map.getSource('lead-source')) {
      map.removeSource('lead-source');
    }

    // Add the lead to the map
    const { lead, center, zoom } = input.response || input;

    if (lead && lead.geometry) {
      // Add the lead as a source
      map.addSource('lead-source', {
        type: 'geojson',
        data: lead
      });

      // Add circle layer for point
      map.addLayer({
        id: 'lead-circle',
        type: 'circle',
        source: 'lead-source',
        paint: {
          'circle-radius': 10,
          'circle-color': '#e74c3c',
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#c0392b'
        }
      });

      // Add label layer
      map.addLayer({
        id: 'lead-label',
        type: 'symbol',
        source: 'lead-source',
        layout: {
          'text-field': ['get', 'ProjectName'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#333',
          'text-halo-color': '#fff',
          'text-halo-width': 2
        }
      });

      // Move the map to the lead
      if (center) {
        const options = {
          center,
          zoom: zoom || 14,
          essential: true
        };

        if (animate !== false) {
          map.flyTo(options);
        } else {
          map.jumpTo(options);
        }
      }

      // Return success with lead info
      return {
        success: true,
        id,
        county,
        center,
        zoom,
        properties: lead.properties
      };
    } else {
      throw new Error('Invalid lead data received');
    }
  } catch (error) {
    console.error('ArcGIS lead search error:', error);
    throw new Error('Failed to search for lead: ' + error.message);
  }
}

// Handle ArcGIS parcel query (multiple parcels)
async function handleArcGISParcelQuery(input) {
  try {
    console.log('Querying parcels:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { county, where, animate } = input;

    // Clear any existing parcel query layers
    if (map.getLayer('parcels-fill')) {
      map.removeLayer('parcels-fill');
    }
    if (map.getLayer('parcels-outline')) {
      map.removeLayer('parcels-outline');
    }
    if (map.getLayer('parcels-symbol')) {
      map.removeLayer('parcels-symbol');
    }
    if (map.getSource('parcels-source')) {
      map.removeSource('parcels-source');
    }

    // We need to call the server to get the query results
    // For our demo version, we get these results from input
    const { parcels, center, bounds, zoom } = input.response || input;

    // Check if we have valid parcels
    if (parcels && parcels.length > 0) {
      // Create a GeoJSON feature collection from all parcels
      const featureCollection = {
        type: 'FeatureCollection',
        features: parcels
      };

      // Add the parcels as a source
      map.addSource('parcels-source', {
        type: 'geojson',
        data: featureCollection
      });

      // Add fill layer for all parcels
      map.addLayer({
        id: 'parcels-fill',
        type: 'fill',
        source: 'parcels-source',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'ACRES'],
            1, '#c6dbef',
            5, '#9ecae1',
            10, '#6baed6',
            20, '#4292c6',
            50, '#2171b5',
            100, '#084594'
          ],
          'fill-opacity': 0.6
        }
      });

      // Add outline layer
      map.addLayer({
        id: 'parcels-outline',
        type: 'line',
        source: 'parcels-source',
        paint: {
          'line-color': '#2c3e50',
          'line-width': 1
        }
      });

      // Add label layer with APN numbers
      map.addLayer({
        id: 'parcels-symbol',
        type: 'symbol',
        source: 'parcels-source',
        layout: {
          'text-field': ['get', 'APN'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-anchor': 'center'
        },
        paint: {
          'text-color': '#000',
          'text-halo-color': '#fff',
          'text-halo-width': 1
        }
      });

      // Move the map to fit all parcels
      if (bounds) {
        // Create a LngLatBounds object from the SW and NE coordinates
        const mapboxBounds = new mapboxgl.LngLatBounds(
          [bounds[0][0], bounds[0][1]], // SW
          [bounds[1][0], bounds[1][1]]  // NE
        );

        // Fit the map to the bounds with padding
        const options = {
          padding: 50,
          essential: true
        };

        if (animate !== false) {
          map.fitBounds(mapboxBounds, options);
        } else {
          map.fitBounds(mapboxBounds, { ...options, duration: 0 });
        }
      } else if (center) {
        // If no bounds but we have a center, use that
        const options = {
          center,
          zoom: zoom || 12,
          essential: true
        };

        if (animate !== false) {
          map.flyTo(options);
        } else {
          map.jumpTo(options);
        }
      }

      // Return success with parcel query info
      return {
        success: true,
        county,
        where,
        center,
        bounds,
        count: parcels.length
      };
    } else {
      // No parcels found but still a successful query
      return {
        success: true,
        county,
        where,
        count: 0,
        message: 'No parcels found matching the query criteria'
      };
    }
  } catch (error) {
    console.error('ArcGIS parcel query error:', error);
    throw new Error('Failed to query parcels: ' + error.message);
  }
}

// Handle ArcGIS lead query (multiple leads)
async function handleArcGISLeadQuery(input) {
  try {
    console.log('Querying leads:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { county, where, animate } = input;

    // Clear any existing lead query layers
    if (map.getLayer('leads-circle')) {
      map.removeLayer('leads-circle');
    }
    if (map.getLayer('leads-label')) {
      map.removeLayer('leads-label');
    }
    if (map.getSource('leads-source')) {
      map.removeSource('leads-source');
    }

    // We need to call the server to get the query results
    // For our demo version, we get these results from input
    const { leads, center, bounds, zoom } = input.response || input;

    // Check if we have valid leads
    if (leads && leads.length > 0) {
      // Create a GeoJSON feature collection from all leads
      const featureCollection = {
        type: 'FeatureCollection',
        features: leads
      };

      // Add the leads as a source
      map.addSource('leads-source', {
        type: 'geojson',
        data: featureCollection
      });

      // Add circle layer for all points
      map.addLayer({
        id: 'leads-circle',
        type: 'circle',
        source: 'leads-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 3,
            12, 8,
            16, 12
          ],
          'circle-color': [
            'match',
            ['get', 'STATUS'],
            'Active', '#2ecc71',
            'Pending', '#f39c12',
            'Inactive', '#e74c3c',
            'Closed', '#7f8c8d',
            '#3498db' // default color
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });

      // Add label layer with project names
      map.addLayer({
        id: 'leads-label',
        type: 'symbol',
        source: 'leads-source',
        layout: {
          'text-field': ['get', 'PROJECT_NAME'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 0, // No text at lower zoom levels
            12, 8,
            16, 12
          ],
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-ignore-placement': false
        },
        paint: {
          'text-color': '#333',
          'text-halo-color': '#fff',
          'text-halo-width': 2
        }
      });

      // Move the map to fit all leads
      if (bounds) {
        // Create a LngLatBounds object from the SW and NE coordinates
        const mapboxBounds = new mapboxgl.LngLatBounds(
          [bounds[0][0], bounds[0][1]], // SW
          [bounds[1][0], bounds[1][1]]  // NE
        );

        // Fit the map to the bounds with padding
        const options = {
          padding: 50,
          essential: true
        };

        if (animate !== false) {
          map.fitBounds(mapboxBounds, options);
        } else {
          map.fitBounds(mapboxBounds, { ...options, duration: 0 });
        }
      } else if (center) {
        // If no bounds but we have a center, use that
        const options = {
          center,
          zoom: zoom || 12,
          essential: true
        };

        if (animate !== false) {
          map.flyTo(options);
        } else {
          map.jumpTo(options);
        }
      }

      // Return success with lead query info
      return {
        success: true,
        county,
        where,
        center,
        bounds,
        count: leads.length
      };
    } else {
      // No leads found but still a successful query
      return {
        success: true,
        county,
        where,
        count: 0,
        message: 'No leads found matching the query criteria'
      };
    }
  } catch (error) {
    console.error('ArcGIS lead query error:', error);
    throw new Error('Failed to query leads: ' + error.message);
  }
}

// Handle adding polygons for geographic areas
async function handleMapAddPolygon(input) {
  try {
    console.log('Adding polygon for area:', input.query);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { query, style = {}, animate = true } = input;

    // Use OpenStreetMap Nominatim API to search for areas with polygon boundaries
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&polygon_geojson=1&limit=1&addressdetails=1`;

    const response = await fetch(nominatimUrl);
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Nominatim response:', data);

    if (!data || data.length === 0) {
      throw new Error(`Area "${query}" not found`);
    }

    const result = data[0];
    
    // Check if we have polygon data
    if (!result.geojson || (result.geojson.type !== 'Polygon' && result.geojson.type !== 'MultiPolygon')) {
      // If no polygon data, create a rough circular polygon around the point
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      const radius = 0.01; // Rough radius in degrees (about 1km)
      
      // Create a simple circular polygon
      const points = [];
      const numPoints = 16;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        const x = lng + radius * Math.cos(angle);
        const y = lat + radius * Math.sin(angle);
        points.push([x, y]);
      }
      points.push(points[0]); // Close the polygon
      
      result.geojson = {
        type: 'Polygon',
        coordinates: [points]
      };
    }

    // Create GeoJSON feature
    const feature = {
      type: 'Feature',
      properties: {
        name: result.display_name,
        type: result.type,
        class: result.class
      },
      geometry: result.geojson
    };

    // Generate unique layer IDs
    const layerId = `polygon-${Date.now()}`;
    const sourceId = `${layerId}-source`;

    // Remove any existing polygon layers with the same query
    const existingLayers = map.getStyle().layers.filter(layer => 
      layer.id.startsWith('polygon-') && layer.source && 
      map.getSource(layer.source)?.data?.properties?.name === result.display_name
    );
    
    existingLayers.forEach(layer => {
      if (map.getLayer(layer.id)) {
        map.removeLayer(layer.id);
      }
      if (map.getSource(layer.source)) {
        map.removeSource(layer.source);
      }
    });

    // Add the polygon source
    map.addSource(sourceId, {
      type: 'geojson',
      data: feature
    });

    // Set up styling with defaults
    const fillColor = style.fillColor || '#3498db';
    const fillOpacity = style.fillOpacity || 0.3;
    const strokeColor = style.strokeColor || '#2980b9';
    const strokeWidth = style.strokeWidth || 2;

    // Add fill layer
    map.addLayer({
      id: `${layerId}-fill`,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': fillColor,
        'fill-opacity': fillOpacity
      }
    });

    // Add outline layer
    map.addLayer({
      id: `${layerId}-outline`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': strokeColor,
        'line-width': strokeWidth
      }
    });

    // Fit map to polygon bounds
    const bounds = new mapboxgl.LngLatBounds();
    
    if (result.geojson.type === 'Polygon') {
      result.geojson.coordinates[0].forEach(coord => {
        bounds.extend(coord);
      });
    } else if (result.geojson.type === 'MultiPolygon') {
      result.geojson.coordinates.forEach(polygon => {
        polygon[0].forEach(coord => {
          bounds.extend(coord);
        });
      });
    }

    // Fit the map to the polygon with padding
    const fitOptions = {
      padding: 50,
      essential: true
    };

    if (animate) {
      map.fitBounds(bounds, fitOptions);
    } else {
      map.fitBounds(bounds, { ...fitOptions, duration: 0 });
    }

    return {
      success: true,
      query,
      name: result.display_name,
      type: result.type,
      layerId,
      bounds: [
        [bounds.getWest(), bounds.getSouth()],
        [bounds.getEast(), bounds.getNorth()]
      ]
    };

  } catch (error) {
    console.error('Add polygon error:', error);
    throw new Error('Failed to add polygon: ' + error.message);
  }
}

// Handle ArcGIS bounding box queries
async function handleArcGISBboxQuery(input) {
  try {
    console.log('ArcGIS bbox query:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { layer, county, bounds, animate = true } = input;
    const [xmin, ymin, xmax, ymax] = bounds;

    // Performance checks and limits
    const currentZoom = map.getZoom();
    const currentBounds = map.getBounds();
    
    // Calculate area of query bounds (rough estimation)
    const queryArea = Math.abs(xmax - xmin) * Math.abs(ymax - ymin);
    
    // Zoom-based feature limits
    const getFeatureLimit = (zoom, layer) => {
      if (layer === 'parcels' || layer === 'leads') {
        if (zoom < 10) return 0; // No parcels/leads at very low zoom
        if (zoom < 12) return 500;
        if (zoom < 14) return 2000;
        if (zoom < 16) return 5000;
        return 10000;
      } else if (layer === 'ownerindex') {
        if (zoom < 11) return 0;
        if (zoom < 13) return 1000;
        return 5000;
      } else {
        // Other layers (transfers, plss, etc.)
        if (zoom < 8) return 0;
        if (zoom < 10) return 1000;
        if (zoom < 12) return 3000;
        return 5000;
      }
    };

    const maxFeatures = getFeatureLimit(currentZoom, layer);
    
    if (maxFeatures === 0) {
      return {
        success: false,
        layer,
        county,
        bounds,
        message: `Zoom in to at least level ${layer === 'parcels' ? 10 : layer === 'ownerindex' ? 11 : 8} to view ${layer} data`,
        featureCount: 0,
        zoomRequired: true
      };
    }

    // Area-based restrictions (prevent massive queries)
    const maxArea = {
      parcels: 0.1,    // ~10km x 10km max for parcels
      leads: 0.5,      // ~50km x 50km max for leads  
      ownerindex: 0.2, // ~20km x 20km max for owner index
      default: 1.0     // ~100km x 100km for other layers
    };

    const allowedArea = maxArea[layer] || maxArea.default;
    
    if (queryArea > allowedArea) {
      return {
        success: false,
        layer,
        county,
        bounds,
        message: `Query area too large for ${layer} data. Please zoom in or select a smaller area.`,
        featureCount: 0,
        areaTooLarge: true
      };
    }

    // Use current map bounds if no bounds specified or if bounds are larger than current view
    let queryBounds = bounds;
    const currentBoundsArray = [
      currentBounds.getWest(),
      currentBounds.getSouth(), 
      currentBounds.getEast(),
      currentBounds.getNorth()
    ];
    
    // If query bounds are much larger than current view, use current view instead
    if (queryArea > (Math.abs(currentBoundsArray[2] - currentBoundsArray[0]) * 
                     Math.abs(currentBoundsArray[3] - currentBoundsArray[1]) * 4)) {
      queryBounds = currentBoundsArray;
      console.log('Using current map bounds to prevent overfetching:', queryBounds);
    }

    const [qxmin, qymin, qxmax, qymax] = queryBounds;

    console.log(`Fetching ${layer} data with ${maxFeatures} feature limit at zoom ${currentZoom.toFixed(1)}`);
    
    // Call our backend endpoint instead of external API
    const response = await fetch('/api/arcgis/bbox-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        layer,
        county,
        bounds: queryBounds,
        limit: maxFeatures
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${layer} data: ${response.statusText}`);
    }

    const result = await response.json();

    // Handle the response
    let featureCount = 0;
    let isLimited = false;
    
    // Add data to map if we got results
    if (result.success && result.data && result.data.features && result.data.features.length > 0) {
      const layerId = `arcgis-${layer}-${Date.now()}`;
      featureCount = result.data.features.length;
      isLimited = featureCount >= maxFeatures;

      // Clear any existing layers of the same type to prevent overlap
      const existingLayers = map.getStyle().layers.filter(l => l.id.includes(`arcgis-${layer}-`));
      existingLayers.forEach(l => {
        if (map.getLayer(l.id)) map.removeLayer(l.id);
      });
      
      const existingSources = Object.keys(map.getStyle().sources).filter(s => s.includes(`arcgis-${layer}-`));
      existingSources.forEach(s => {
        if (map.getSource(s)) map.removeSource(s);
      });

      // Add source and layers
      map.addSource(layerId, {
        type: 'geojson',
        data: result.data
      });

      // Add fill layer for polygons
      map.addLayer({
        id: `${layerId}-fill`,
        type: 'fill',
        source: layerId,
        paint: {
          'fill-color': layer === 'parcels' ? '#27ae60' : 
                       layer === 'leads' ? '#e74c3c' :
                       layer === 'ownerindex' ? '#3498db' : '#9b59b6',
          'fill-opacity': 0.4
        },
        filter: ['==', '$type', 'Polygon']
      });

      // Add line layer for boundaries
      map.addLayer({
        id: `${layerId}-line`,
        type: 'line',
        source: layerId,
        paint: {
          'line-color': layer === 'parcels' ? '#27ae60' : 
                       layer === 'leads' ? '#e74c3c' :
                       layer === 'ownerindex' ? '#3498db' : '#9b59b6',
          'line-width': currentZoom > 14 ? 2 : 1
        }
      });

      // Add circle layer for points
      map.addLayer({
        id: `${layerId}-circle`,
        type: 'circle',
        source: layerId,
        paint: {
          'circle-radius': currentZoom > 12 ? 6 : 4,
          'circle-color': layer === 'leads' ? '#e74c3c' : '#3498db',
          'circle-stroke-width': currentZoom > 14 ? 2 : 1,
          'circle-stroke-color': '#ffffff'
        },
        filter: ['==', '$type', 'Point']
      });

      // Fit map to data bounds if animate is true and bounds are reasonable
      if (animate && !isLimited) {
        const boundsArray = [qxmin, qymin, qxmax, qymax];
        map.fitBounds(boundsArray, { padding: 50 });
      }
    }

    let message = result.message || `Found ${featureCount} ${layer} features`;
    if (isLimited) {
      message += ` (limited to ${maxFeatures}). Zoom in for more detail or use a smaller area.`;
    }

    return {
      success: result.success,
      layer,
      county,
      bounds: queryBounds,
      featureCount,
      maxFeatures,
      isLimited,
      currentZoom: currentZoom.toFixed(1),
      message
    };

  } catch (error) {
    console.error('ArcGIS bbox query error:', error);
    throw new Error('Failed to query ArcGIS layer: ' + error.message);
  }
}

// Handle ArcGIS radius queries
async function handleArcGISRadiusQuery(input) {
  try {
    console.log('ArcGIS radius query:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { layer, center, radius = 1000, koordinatesLayer, animate = true } = input;
    const [lng, lat] = center;

    // Performance checks
    const currentZoom = map.getZoom();
    
    // Zoom-based feature limits for radius queries
    const getRadiusFeatureLimit = (zoom, layer) => {
      if (layer === 'ownerindex') {
        if (zoom < 10) return 0;
        if (zoom < 12) return 500;
        if (zoom < 14) return 2000;
        return 5000;
      } else if (layer === 'koordinates') {
        if (zoom < 8) return 0;
        if (zoom < 10) return 1000;
        if (zoom < 12) return 3000;
        return 5000;
      }
      return 1000; // Default
    };

    const maxFeatures = getRadiusFeatureLimit(currentZoom, layer);
    
    if (maxFeatures === 0) {
      return {
        success: false,
        layer,
        center,
        radius,
        message: `Zoom in to at least level ${layer === 'ownerindex' ? 10 : 8} to view ${layer} data`,
        featureCount: 0,
        zoomRequired: true
      };
    }

    // Radius-based restrictions (prevent massive queries)
    const maxRadius = {
      ownerindex: currentZoom < 12 ? 5000 : currentZoom < 14 ? 10000 : 20000,
      koordinates: currentZoom < 10 ? 10000 : currentZoom < 12 ? 50000 : 100000
    };

    const allowedRadius = maxRadius[layer] || 50000;
    
    if (radius > allowedRadius) {
      return {
        success: false,
        layer,
        center,
        radius,
        message: `Radius too large for ${layer} data at this zoom level. Maximum: ${allowedRadius}m. Please zoom in or use a smaller radius.`,
        featureCount: 0,
        radiusTooLarge: true
      };
    }

    console.log(`Fetching ${layer} radius data with ${maxFeatures} feature limit at zoom ${currentZoom.toFixed(1)}`);

    // Call our backend endpoint instead of external API
    const response = await fetch('/api/arcgis/radius-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        layer,
        center,
        radius,
        koordinatesLayer,
        limit: maxFeatures
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${layer} data: ${response.statusText}`);
    }

    const result = await response.json();

    // Clear any existing radius query layers to prevent overlap
    const existingLayers = map.getStyle().layers.filter(l => l.id.includes(`arcgis-radius-${layer}-`));
    existingLayers.forEach(l => {
      if (map.getLayer(l.id)) map.removeLayer(l.id);
    });
    
    const existingSources = Object.keys(map.getStyle().sources).filter(s => s.includes(`arcgis-radius-${layer}-`));
    existingSources.forEach(s => {
      if (map.getSource(s)) map.removeSource(s);
    });

    // Add data to map
    const layerId = `arcgis-radius-${layer}-${Date.now()}`;
    let featureCount = 0;
    let isLimited = false;
    
    if (result.success && result.data && result.data.features && result.data.features.length > 0) {
      featureCount = result.data.features.length;
      isLimited = featureCount >= maxFeatures;

      map.addSource(layerId, {
        type: 'geojson',
        data: result.data
      });

      // Add visualization layers with zoom-responsive styling
      map.addLayer({
        id: `${layerId}-fill`,
        type: 'fill',
        source: layerId,
        paint: {
          'fill-color': '#e67e22',
          'fill-opacity': 0.5
        },
        filter: ['==', '$type', 'Polygon']
      });

      map.addLayer({
        id: `${layerId}-circle`,
        type: 'circle',
        source: layerId,
        paint: {
          'circle-radius': currentZoom > 12 ? 8 : 6,
          'circle-color': '#e67e22',
          'circle-stroke-width': currentZoom > 14 ? 2 : 1,
          'circle-stroke-color': '#ffffff'
        },
        filter: ['==', '$type', 'Point']
      });
    }

    // Add radius circle with appropriate styling
    const radiusCircle = turf.circle([lng, lat], radius / 1000, { units: 'kilometers' });
    map.addSource(`${layerId}-radius`, {
      type: 'geojson',
      data: radiusCircle
    });

    map.addLayer({
      id: `${layerId}-radius-line`,
      type: 'line',
      source: `${layerId}-radius`,
      paint: {
        'line-color': '#34495e',
        'line-width': currentZoom > 12 ? 2 : 1,
        'line-dasharray': [5, 5]
      }
    });

    // Add center point marker
    const centerPoint = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties: { type: 'center' }
    };

    map.addSource(`${layerId}-center`, {
      type: 'geojson',
      data: centerPoint
    });

    map.addLayer({
      id: `${layerId}-center`,
      type: 'circle',
      source: `${layerId}-center`,
      paint: {
        'circle-radius': 8,
        'circle-color': '#e74c3c',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Animate to center point if not limited
    if (animate && !isLimited) {
      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(currentZoom, 14),
        essential: true
      });
    }

    let message = result.message || `Found ${featureCount} ${layer} features within ${radius}m`;
    if (isLimited) {
      message += ` (limited to ${maxFeatures}). Zoom in for more detail or use a smaller radius.`;
    }

    return {
      success: result.success,
      layer,
      center,
      radius,
      featureCount,
      maxFeatures,
      isLimited,
      currentZoom: currentZoom.toFixed(1),
      message
    };

  } catch (error) {
    console.error('ArcGIS radius query error:', error);
    throw new Error('Failed to perform radius query: ' + error.message);
  }
}

// Handle ArcGIS layer search
async function handleArcGISLayerSearch(input) {
  try {
    console.log('ArcGIS layer search:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { layer, searchParams, animate = true } = input;
    const baseUrl = 'https://app.landadvisors.com/db';
    let endpoint;

    switch (layer) {
      case 'ownerindex-search':
        if (!searchParams.pid) throw new Error('PID required for ownerindex-search');
        endpoint = `${baseUrl}/ownerindex-search?pid=${encodeURIComponent(searchParams.pid)}`;
        break;
      case 'zams':
        if (!searchParams.where || !searchParams.zamsLayer) {
          throw new Error('where clause and zamsLayer required for ZAMS queries');
        }
        endpoint = `${baseUrl}/zams?layer=${searchParams.zamsLayer}&where=${encodeURIComponent(searchParams.where)}`;
        break;
      default:
        throw new Error(`Unsupported layer search type: ${layer}`);
    }

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to search ${layer}: ${response.statusText}`);
    }

    const data = await response.json();

    // Add search results to map
    const layerId = `arcgis-search-${layer}-${Date.now()}`;
    
    if (data && data.features && data.features.length > 0) {
      map.addSource(layerId, {
        type: 'geojson',
        data: data
      });

      // Add visualization with distinct styling
      map.addLayer({
        id: `${layerId}-fill`,
        type: 'fill',
        source: layerId,
        paint: {
          'fill-color': '#f39c12',
          'fill-opacity': 0.6
        },
        filter: ['==', '$type', 'Polygon']
      });

      map.addLayer({
        id: `${layerId}-line`,
        type: 'line',
        source: layerId,
        paint: {
          'line-color': '#e67e22',
          'line-width': 3
        }
      });

      // Fit map to search results
      if (animate) {
        const bounds = new mapboxgl.LngLatBounds();
        data.features.forEach(feature => {
          if (feature.geometry.type === 'Point') {
            bounds.extend(feature.geometry.coordinates);
          } else if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(coord => bounds.extend(coord));
          }
        });
        
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 50 });
        }
      }
    }

    return {
      success: true,
      layer,
      searchParams,
      featureCount: data?.features?.length || 0
    };

  } catch (error) {
    console.error('ArcGIS layer search error:', error);
    throw new Error('Failed to search layer: ' + error.message);
  }
}

// Handle ArcGIS point queries
async function handleArcGISPointQuery(input) {
  try {
    console.log('ArcGIS point query:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { layer, point, county, koordinatesLayer, animate = true } = input;
    const [lng, lat] = point;
    const currentZoom = map.getZoom();

    // Basic zoom requirements for point queries
    if (layer === 'parcels' && currentZoom < 12) {
      return {
        success: false,
        layer,
        point,
        county,
        message: 'Zoom in to at least level 12 to query parcel data at specific points',
        featureCount: 0,
        zoomRequired: true
      };
    }

    console.log(`Querying ${layer} at point [${lng}, ${lat}] at zoom ${currentZoom.toFixed(1)}`);

    // Call our backend endpoint instead of external API
    const response = await fetch('/api/arcgis/point-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        layer,
        point,
        county,
        koordinatesLayer
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to query ${layer} at point: ${response.statusText}`);
    }

    const result = await response.json();

    // Clear any existing point query layers
    const existingLayers = map.getStyle().layers.filter(l => l.id.includes(`arcgis-point-${layer}-`));
    existingLayers.forEach(l => {
      if (map.getLayer(l.id)) map.removeLayer(l.id);
    });
    
    const existingSources = Object.keys(map.getStyle().sources).filter(s => s.includes(`arcgis-point-${layer}-`));
    existingSources.forEach(s => {
      if (map.getSource(s)) map.removeSource(s);
    });

    // Add query point and results to map
    const layerId = `arcgis-point-${layer}-${Date.now()}`;
    
    // Add point marker
    const pointFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties: {
        query: 'point'
      }
    };

    map.addSource(`${layerId}-point`, {
      type: 'geojson',
      data: pointFeature
    });

    map.addLayer({
      id: `${layerId}-point`,
      type: 'circle',
      source: `${layerId}-point`,
      paint: {
        'circle-radius': currentZoom > 14 ? 10 : 8,
        'circle-color': '#e74c3c',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add results if any
    let featureCount = 0;
    
    if (result.success && result.data && result.data.features && result.data.features.length > 0) {
      featureCount = result.data.features.length;

      map.addSource(layerId, {
        type: 'geojson',
        data: result.data
      });

      map.addLayer({
        id: `${layerId}-fill`,
        type: 'fill',
        source: layerId,
        paint: {
          'fill-color': '#2ecc71',
          'fill-opacity': 0.7
        },
        filter: ['==', '$type', 'Polygon']
      });

      map.addLayer({
        id: `${layerId}-line`,
        type: 'line',
        source: layerId,
        paint: {
          'line-color': '#27ae60',
          'line-width': currentZoom > 14 ? 3 : 2
        }
      });
    }

    // Center map on point with appropriate zoom
    if (animate) {
      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(currentZoom, 16),
        essential: true
      });
    }

    return {
      success: result.success,
      layer,
      point,
      county,
      featureCount,
      currentZoom: currentZoom.toFixed(1),
      message: result.message || (featureCount > 0 ? 
        `Found ${featureCount} ${layer} feature(s) at this location` :
        `No ${layer} features found at this location`)
    };

  } catch (error) {
    console.error('ArcGIS point query error:', error);
    throw new Error('Failed to query point: ' + error.message);
  }
}

// Handle ArcGIS data visualization
async function handleArcGISDataVisualize(input) {
  try {
    console.log('ArcGIS data visualization:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { dataType, data, style = {}, fitBounds = true } = input;

    if (!data || !data.features) {
      throw new Error('Invalid GeoJSON data provided');
    }

    const layerId = `arcgis-viz-${dataType}-${Date.now()}`;

    // Default styling based on data type
    const defaultStyles = {
      parcels: { fillColor: '#27ae60', strokeColor: '#2ecc71', fillOpacity: 0.5 },
      leads: { fillColor: '#e74c3c', strokeColor: '#c0392b', fillOpacity: 0.6 },
      ownerindex: { fillColor: '#3498db', strokeColor: '#2980b9', fillOpacity: 0.4 },
      transfers: { fillColor: '#9b59b6', strokeColor: '#8e44ad', fillOpacity: 0.5 },
      plss: { fillColor: '#f39c12', strokeColor: '#e67e22', fillOpacity: 0.3 }
    };

    const appliedStyle = {
      ...defaultStyles[dataType],
      ...style
    };

    // Add data source
    map.addSource(layerId, {
      type: 'geojson',
      data: data
    });

    // Add polygon fill layer
    map.addLayer({
      id: `${layerId}-fill`,
      type: 'fill',
      source: layerId,
      paint: {
        'fill-color': appliedStyle.fillColor,
        'fill-opacity': appliedStyle.fillOpacity
      },
      filter: ['==', '$type', 'Polygon']
    });

    // Add line layer
    map.addLayer({
      id: `${layerId}-line`,
      type: 'line',
      source: layerId,
      paint: {
        'line-color': appliedStyle.strokeColor,
        'line-width': appliedStyle.strokeWidth || 2
      }
    });

    // Add circle layer for points
    map.addLayer({
      id: `${layerId}-circle`,
      type: 'circle',
      source: layerId,
      paint: {
        'circle-radius': 6,
        'circle-color': appliedStyle.fillColor,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      },
      filter: ['==', '$type', 'Point']
    });

    // Fit bounds to data if requested
    if (fitBounds && data.features.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      data.features.forEach(feature => {
        if (feature.geometry.type === 'Point') {
          bounds.extend(feature.geometry.coordinates);
        } else if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach(coord => bounds.extend(coord));
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach(polygon => {
            polygon[0].forEach(coord => bounds.extend(coord));
          });
        }
      });
      
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50 });
      }
    }

    return {
      success: true,
      dataType,
      layerId,
      featureCount: data.features.length,
      style: appliedStyle
    };

  } catch (error) {
    console.error('ArcGIS data visualization error:', error);
    throw new Error('Failed to visualize data: ' + error.message);
  }
}

// UI Helper Functions
function addMessage(content, type) {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}-message`;
  messageDiv.innerText = content;
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addLoadingIndicator() {
  const chatMessages = document.getElementById('chat-messages');
  const loaderDiv = document.createElement('div');
  loaderDiv.className = 'message bot-message loading-message';
  
  const loader = document.createElement('div');
  loader.className = 'loader';
  loaderDiv.appendChild(loader);
  
  chatMessages.appendChild(loaderDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  return loaderDiv;
}

function removeLoadingIndicator(loadingIndicator) {
  if (loadingIndicator && loadingIndicator.parentNode) {
    loadingIndicator.parentNode.removeChild(loadingIndicator);
  }
}

// Utility Functions
function generateRequestId() {
  return 'req_' + Math.random().toString(36).substring(2, 15);
}

// Utility function to clear all ArcGIS layers
function clearArcGISLayers() {
  if (!map) return;

  try {
    const layersToRemove = map.getStyle().layers.filter(layer => 
      layer.id.includes('arcgis-') || 
      layer.id.includes('polygon-') ||
      layer.id.includes('parcel-') ||
      layer.id.includes('lead-')
    );
    
    const sourcesToRemove = Object.keys(map.getStyle().sources).filter(source => 
      source.includes('arcgis-') || 
      source.includes('polygon-') ||
      source.includes('parcel-') ||
      source.includes('lead-')
    );

    console.log(`Clearing ${layersToRemove.length} layers and ${sourcesToRemove.length} sources`);

    layersToRemove.forEach(layer => {
      if (map.getLayer(layer.id)) {
        map.removeLayer(layer.id);
      }
    });

    sourcesToRemove.forEach(source => {
      if (map.getSource(source)) {
        map.removeSource(source);
      }
    });

    return {
      success: true,
      layersRemoved: layersToRemove.length,
      sourcesRemoved: sourcesToRemove.length
    };
  } catch (error) {
    console.error('Error clearing ArcGIS layers:', error);
    throw new Error('Failed to clear layers: ' + error.message);
  }
}

// Performance monitoring function
function getMapPerformanceInfo() {
  if (!map) return null;

  const style = map.getStyle();
  const layerCount = style.layers.length;
  const sourceCount = Object.keys(style.sources).length;
  const arcgisLayerCount = style.layers.filter(l => l.id.includes('arcgis-')).length;
  const currentZoom = map.getZoom();

  return {
    totalLayers: layerCount,
    totalSources: sourceCount,
    arcgisLayers: arcgisLayerCount,
    currentZoom: currentZoom.toFixed(2),
    mapLoaded: map.loaded()
  };
}

// Handle clearing map layers
function handleMapClearLayers(input) {
  try {
    console.log('Clearing map layers:', input);

    if (!map) {
      throw new Error('Map not initialized');
    }

    const { confirm = true } = input;
    
    if (!confirm) {
      return {
        success: false,
        message: 'Layer clearing cancelled - confirmation required'
      };
    }

    const performanceInfo = getMapPerformanceInfo();
    const result = clearArcGISLayers();

    return {
      success: true,
      message: `Cleared ${result.layersRemoved} layers and ${result.sourcesRemoved} sources from the map`,
      beforeClear: performanceInfo,
      layersRemoved: result.layersRemoved,
      sourcesRemoved: result.sourcesRemoved
    };

  } catch (error) {
    console.error('Map clear layers error:', error);
    throw new Error('Failed to clear layers: ' + error.message);
  }
}