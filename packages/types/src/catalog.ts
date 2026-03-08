import type { DateTimeString, Money } from './common.js';

export type ListingType = 'tour' | 'hotel' | 'rental' | 'transfer' | 'car' | 'package';

export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'inactive' | 'archived';

export interface Destination {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

export interface ListingCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  iconUrl: string | null;
}

export interface Listing {
  id: string;
  providerId: string;
  categoryId: string;
  destinationId: string;
  type: ListingType;
  status: ListingStatus;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverImageUrl: string | null;
  location: string | null;
  mediaAssets: MediaAsset[];
  basePrice: Money;
  currencyCode: string;
  durationMinutes: number | null;
  maxCapacity: number | null;
  minGuests: number | null;
  isInstantBooking: boolean;
  tags: string[];
  amenities: string[];
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface MediaAsset {
  id: string;
  entityType: string;
  entityId: string;
  purpose: 'cover' | 'gallery' | 'document' | 'avatar';
  url: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  createdAt: DateTimeString;
}

export interface PricingRule {
  id: string;
  listingId: string;
  name: string;
  pricePerUnit: Money;
  unitType: 'per_person' | 'per_group' | 'per_night' | 'per_day' | 'per_vehicle' | 'flat';
  minUnits: number;
  maxUnits: number | null;
  isActive: boolean;
}

export interface AvailabilitySlot {
  date: string;
  available: boolean;
  remainingCapacity: number | null;
  price: Money | null;
}
