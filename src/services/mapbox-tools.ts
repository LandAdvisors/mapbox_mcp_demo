import {
  MapInitializeTool,
  MapMoveTool,
  MapAddLayerTool,
  MapRemoveLayerTool,
  MapGetFeaturesTool,
  MapSearchTool,
  MapGetBoundsTool,
  MapAddPolygonTool
} from '../types/mcp';

// Define Mapbox
export const mapboxTools = [
  {
    name: "map_initialize",
    description: "Initialize a Mapbox map with specified options",
    input_schema: {
      type: "object",
      properties: {
        center: {
          type: "array",
          items: { type: "number" },
          minItems: 2,
          maxItems: 2,
          description: "Longitude and latitude for the center of the map"
        },
        zoom: { 
          type: "number",
          description: "Initial zoom level"
        },
        style: {
          type: "string",
          description: "URL or style JSON for the map"
        }
      },
      required: ["center", "zoom"]
    }
  } as MapInitializeTool,
  
  {
    name: "map_move",
    description: "Move the map to a specified location",
    input_schema: {
      type: "object",
      properties: {
        center: {
          type: "array",
          items: { type: "number" },
          minItems: 2,
          maxItems: 2,
          description: "Longitude and latitude to move the map to"
        },
        zoom: { 
          type: "number",
          description: "Zoom level to set" 
        },
        bearing: { 
          type: "number",
          description: "Map bearing in degrees" 
        },
        pitch: { 
          type: "number",
          description: "Map pitch in degrees" 
        },
        animate: { 
          type: "boolean",
          description: "Whether to animate the movement" 
        },
        duration: { 
          type: "number",
          description: "Duration of animation in milliseconds" 
        }
      },
      required: ["center"]
    }
  } as MapMoveTool,
  
  {
    name: "map_add_layer",
    description: "Add a new layer to the map",
    input_schema: {
      type: "object",
      properties: {
        id: { 
          type: "string",
          description: "Unique identifier for the layer"
        },
        type: { 
          type: "string",
          enum: ["fill", "line", "symbol", "circle", "heatmap", "fill-extrusion", "raster", "hillshade", "background"],
          description: "Type of the layer"
        },
        source: { 
          oneOf: [
            { type: "string" },
            { 
              type: "object",
              properties: {
                type: { type: "string" },
                data: { type: "object" }
              }
            }
          ],
          description: "Source name or source definition"
        },
        paint: { 
          type: "object",
          description: "Layer paint properties" 
        },
        layout: { 
          type: "object",
          description: "Layer layout properties" 
        }
      },
      required: ["id", "type", "source"]
    }
  } as MapAddLayerTool,
  
  {
    name: "map_remove_layer",
    description: "Remove a layer from the map",
    input_schema: {
      type: "object",
      properties: {
        id: { 
          type: "string",
          description: "Identifier of the layer to remove"
        }
      },
      required: ["id"]
    }
  } as MapRemoveLayerTool,
  
  {
    name: "map_get_features",
    description: "Get features at a point on the map",
    input_schema: {
      type: "object",
      properties: {
        point: {
          type: "array",
          items: { type: "number" },
          minItems: 2,
          maxItems: 2,
          description: "Longitude and latitude of the point"
        },
        layers: {
          type: "array",
          items: { type: "string" },
          description: "Layer IDs to query features from"
        }
      },
      required: ["point"]
    }
  } as MapGetFeaturesTool,

  {
    name: "map_search",
    description: "Search for a location by name and fly to it",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The name of the location to search for (e.g., 'New York', 'Paris', 'Tokyo')"
        },
        zoom: {
          type: "number",
          description: "Zoom level to set after finding the location"
        },
        animate: {
          type: "boolean",
          description: "Whether to animate the movement to the location"
        },
        duration: {
          type: "number",
          description: "Duration of animation in milliseconds"
        }
      },
      required: ["query"]
    }
  } as MapSearchTool,

  {
    name: "map_get_bounds",
    description: "Get the current map bounds (viewport) - useful for spatial queries in the visible area",
    input_schema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["bbox", "geojson", "bounds"],
          description: "Format to return bounds in: 'bbox' [xmin,ymin,xmax,ymax], 'geojson' polygon, or 'bounds' object",
          default: "bbox"
        },
        padding: {
          type: "number",
          description: "Optional padding in pixels to expand the bounds",
          default: 0
        }
      }
    }
  } as MapGetBoundsTool,

  {
    name: "map_add_polygon",
    description: "Add a polygon boundary around a geographic area by searching for the area name",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The name of the geographic area to outline (e.g., 'Lincoln Park Chicago', 'Central Park NYC', 'Golden Gate Park')"
        },
        style: {
          type: "object",
          description: "Styling options for the polygon",
          properties: {
            fillColor: {
              type: "string",
              description: "Fill color for the polygon (hex, rgb, or CSS color name)",
              default: "#3498db"
            },
            fillOpacity: {
              type: "number",
              description: "Fill opacity (0-1)",
              default: 0.3
            },
            strokeColor: {
              type: "string", 
              description: "Stroke color for the polygon outline",
              default: "#2980b9"
            },
            strokeWidth: {
              type: "number",
              description: "Stroke width in pixels",
              default: 2
            }
          }
        },
        animate: {
          type: "boolean",
          description: "Whether to animate the movement to the polygon",
          default: true
        }
      },
      required: ["query"]
    }
  } as MapAddPolygonTool
];