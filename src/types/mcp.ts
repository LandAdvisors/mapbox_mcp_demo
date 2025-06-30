// MCP (Model Control Protocol) types

export interface MCPRequest {
  id: string;
  message: string;
  tools?: MCPTool[];
  model?: string;
}

export interface MCPResponse {
  id: string;
  message: string;
  tool_calls?: MCPToolCall[];
}

export interface MCPTool {
  name: string;
  description: string;
  input_schema: any;
}

export interface MCPToolCall {
  id: string;
  name: string;
  input: any;
}

export interface MCPToolResult {
  id: string;
  output: any;
  error?: string;
}

// Mapbox specific MCP tools

export interface MapInitializeTool extends MCPTool {
  name: "map_initialize";
  description: "Initialize a Mapbox map with specified options";
}

export interface MapMoveTool extends MCPTool {
  name: "map_move";
  description: "Move the map to a specified location";
}

export interface MapAddLayerTool extends MCPTool {
  name: "map_add_layer";
  description: "Add a new layer to the map";
}

export interface MapRemoveLayerTool extends MCPTool {
  name: "map_remove_layer";
  description: "Remove a layer from the map";
}

export interface MapGetFeaturesTool extends MCPTool {
  name: "map_get_features";
  description: "Get features at a point on the map";
}

export interface MapSearchTool extends MCPTool {
  name: "map_search";
  description: "Search for a location by name and fly to it";
}

export interface MapGetBoundsTool extends MCPTool {
  name: "map_get_bounds";
  description: "Get the current map bounds (viewport) - useful for spatial queries in the visible area";
}

export interface ArcGISParcelSearchTool extends MCPTool {
  name: "arcgis_parcel_search";
  description: "Search for property parcels by APN (Assessor's Parcel Number) and county";
}

export interface ArcGISLeadSearchTool extends MCPTool {
  name: "arcgis_lead_search";
  description: "Search for research leads data by ID and county";
}

export interface ArcGISParcelQueryTool extends MCPTool {
  name: "arcgis_parcel_query";
  description: "Query property parcels using filters on fields like acreage, zoning, value, etc.";
}

export interface ArcGISLeadQueryTool extends MCPTool {
  name: "arcgis_lead_query";
  description: "Query research leads using filters on fields like status, property type, price, etc.";
}

export interface MapAddPolygonTool extends MCPTool {
  name: "map_add_polygon";
  description: "Add a polygon boundary around a geographic area by searching for the area name";
}

export type MapboxMCPTool =
  | MapInitializeTool
  | MapMoveTool
  | MapAddLayerTool
  | MapRemoveLayerTool
  | MapGetFeaturesTool
  | MapSearchTool
  | MapGetBoundsTool
  | ArcGISParcelSearchTool
  | ArcGISLeadSearchTool
  | ArcGISParcelQueryTool
  | ArcGISLeadQueryTool
  | MapAddPolygonTool;