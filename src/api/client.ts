export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy_meters?: number | null;
  altitude_meters?: number | null;
  heading_degrees?: number | null;
  speed_mps?: number | null;
}

export interface ServiceProvider {
  provider_id: string;
  name: string;
  service_types: string[];
  location: GeoPoint;
  address: { 
    formatted_address?: string;
    street_name?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    landmark?: string;
  };
  contact: { 
    phone_primary?: string;
    phone_secondary?: string;
    whatsapp?: string;
    emergency_shortcode?: string;
    is_phone_verified?: boolean;
  };
  distance_km: number;
  eta_minutes: number;
  rating?: number;
  review_count?: number;
  availability_status: string;
  verification_status?: string;
  recommendation_score?: number;
  recommendation_reason?: string;
  source: string;
  is_cached: boolean;
  retrieved_at?: string;
}

export interface GuidanceStep {
  step_number: number;
  title: string;
  instruction: string;
  caution?: string;
  is_critical: boolean;
}

export interface RecommendedAction {
  action_id: string;
  action_type: string;
  label: string;
  target_contact?: string;
  target_payload?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    [key: string]: any;
  };
  priority?: number;
}

export interface EmergencyResponse {
  incident: {
    incident_id?: string;
    category: string;
    severity: string;
    confidence?: number;
    description_summary: string;
    requires_immediate_services?: string[];
    is_life_threatening: boolean;
  };
  guidance: {
    summary: string;
    immediate_do_not_do: string[];
    steps: GuidanceStep[];
    first_aid_included?: boolean;
  };
  services: ServiceProvider[];
  recommended_actions: RecommendedAction[];
  ai: {
    classifier_used: string;
    confidence_score: number;
    model_version?: string;
  };
  limitations?: string[];
  conversation_id?: string;
}

export interface ProviderStatus {
  active_mode: string;
  google_places: { configured: boolean; status: string };
  google_routes: { configured: boolean; status: string };
  geoapify?: { configured: boolean; status: string };
  fallback_providers: string[];
  gemini_ai: { configured: boolean; model: string };
}

export interface DiagnosticEntry {
  timestamp: string;
  category: string;
  provider_source: string;
  latency_ms: number;
  results_count: number;
  mode: string;
}

export interface RouteSegment {
  summary: string;
  distance_km: number;
  duration_minutes: number;
  safety_tier: string;
  hazard_warnings: string[];
}

export interface RoutePlanResponse {
  route_id: string;
  origin: GeoPoint;
  destination: GeoPoint;
  total_distance_km: number;
  total_duration_minutes: number;
  safety_tier: string;
  polyline_encoded?: string;
  segments: RouteSegment[];
  nearby_emergency_services: ServiceProvider[];
  provider_source: string;
}

export interface OfflinePackManifest {
  pack_id: string;
  region_name: string;
  version: string;
  created_at: string;
  file_size_bytes: number;
  sha256_checksum: string;
  total_providers: number;
  categories: string[];
}

export interface OfflinePackData {
  manifest: OfflinePackManifest;
  providers?: ServiceProvider[];
  emergency_contacts?: Record<string, string>;
}

export interface GeocodeResponse {
  latitude: number;
  longitude: number;
  display_name: string;
}

export function getDownloadUrl(packId: string): string {
  return `${API_BASE_URL}/offline-packs/${encodeURIComponent(packId)}/download`;
}

export async function requestApi<T>(
  endpoint: string, 
  method: string = 'GET', 
  body?: any,
  timeoutMs: number = 45000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  const token = localStorage.getItem('raahat_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      const errorMsg = json.error?.message || json.detail || `Server returned error (${response.status})`;
      throw new Error(errorMsg);
    }

    return json.data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s. Please check server connectivity.`);
    }
    throw err;
  }
}
