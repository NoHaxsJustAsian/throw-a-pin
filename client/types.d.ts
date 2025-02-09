// types.d.ts
export interface GeoJsonFeature {
    type: string;
    properties: { [key: string]: any };
    geometry: {
      type: string;
      coordinates: any[];
    };
  }
  
  export interface GeoJson {
    type: string;
    features: GeoJsonFeature[];
  }