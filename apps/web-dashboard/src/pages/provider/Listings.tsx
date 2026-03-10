import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBlackoutDateSchema,
  createListingSchema,
  createPricingRuleSchema,
  updateInventorySchema,
  updateListingSchema,
} from '@felix-travel/validation';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, getErrorMessage, titleizeToken, toOptionalNumber, toOptionalTrimmed } from '../../lib/admin-utils.js';

type ListingFormState = {
  categoryId: string;
  destinationId: string;
  type: 'tour' | 'hotel' | 'rental' | 'transfer' | 'car' | 'package';
  status: 'draft' | 'pending_review' | 'active' | 'inactive' | 'archived';
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  basePriceAmount: string;
  currencyCode: string;
  durationMinutes: string;
  maxCapacity: string;
  minGuests: string;
  isInstantBooking: boolean;
  tags: string;
};

type PricingRuleFormState = {
  name: string;
  priceAmount: string;
  currencyCode: string;
  unitType: 'per_person' | 'per_group' | 'per_night' | 'per_day' | 'per_vehicle' | 'flat';
  minUnits: string;
  maxUnits: string;
};

type BlackoutFormState = {
  date: string;
  reason: string;
};

type InventoryFormState = {
  date: string;
  totalCapacity: string;
  isAvailable: boolean;
};

const EMPTY_LISTING_FORM: ListingFormState = {
  categoryId: '',
  destinationId: '',
  type: 'tour',
  status: 'draft',
  title: '',
  slug: '',
  shortDescription: '',
  description: '',
  basePriceAmount: '',
  currencyCode: 'KES',
  durationMinutes: '',
  maxCapacity: '',
  minGuests: '1',
  isInstantBooking: false,
  tags: '',
};

const EMPTY_PRICING_RULE_FORM: PricingRuleFormState = {
  name: '',
  priceAmount: '',
  currencyCode: 'KES',
  unitType: 'per_person',
  minUnits: '1',
  maxUnits: '',
};

const EMPTY_BLACKOUT_FORM: BlackoutFormState = {
  date: new Date().toISOString().slice(0, 10),
  reason: '',
};

const EMPTY_INVENTORY_FORM: InventoryFormState = {
  date: new Date().toISOString().slice(0, 10),
  totalCapacity: '',
  isAvailable: true,
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="dashboard-stat-card">
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-hint">{hint}</span>
    </div>
  );
}

function listingFormFromRecord(listing: any): ListingFormState {
  return {
    categoryId: listing.categoryId,
    destinationId: listing.destinationId,
    type: listing.type,
    status: listing.status,
    title: listing.title,
    slug: listing.slug,
    shortDescription: listing.shortDescription,
    description: listing.description,
    basePriceAmount: String(listing.basePrice?.amount ?? 0),
    currencyCode: listing.currencyCode,
    durationMinutes: listing.durationMinutes != null ? String(listing.durationMinutes) : '',
    maxCapacity: listing.maxCapacity != null ? String(listing.maxCapacity) : '',
    minGuests: listing.minGuests != null ? String(listing.minGuests) : '1',
    isInstantBooking: Boolean(listing.isInstantBooking),
    tags: (listing.tags ?? []).join(', '),
  };
}

export function ProviderListings() {
  const { user } = useAuth();
  const providerId = user?.providerId;
  const queryClient = useQueryClient();
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [listingForm, setListingForm] = useState<ListingFormState>(EMPTY_LISTING_FORM);
  const [pricingRuleForm, setPricingRuleForm] = useState<PricingRuleFormState>(EMPTY_PRICING_RULE_FORM);
  const [blackoutForm, setBlackoutForm] = useState<BlackoutFormState>(EMPTY_BLACKOUT_FORM);
  const [inventoryForm, setInventoryForm] = useState<InventoryFormState>(EMPTY_INVENTORY_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const enabled = Boolean(providerId);

  const { data: listings = [] } = useQuery({
    queryKey: ['provider-listings', providerId],
    queryFn: () => apiClient.providers.getListings(providerId!),
    enabled,
  });

  const { data: destinations = [] } = useQuery({
    queryKey: ['catalog-destinations'],
    queryFn: () => apiClient.catalog.getDestinations(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['catalog-listing-categories'],
    queryFn: () => apiClient.catalog.getListingCategories(),
  });

  const { data: management } = useQuery({
    queryKey: ['provider-listing-management', providerId, selectedListingId],
    queryFn: () => apiClient.providers.getListingManagement(providerId!, selectedListingId!),
    enabled: Boolean(providerId && selectedListingId && !isCreating),
  });

  const selectedListing = (listings as any[]).find((listing) => listing.id === selectedListingId) ?? null;

  useEffect(() => {
    const firstListing = (listings as any[])[0] ?? null;
    if (!firstListing || isCreating) return;
    if (!selectedListingId) {
      setSelectedListingId(firstListing.id);
      return;
    }
    if (!selectedListing) {
      setSelectedListingId(firstListing.id);
    }
  }, [listings, selectedListingId, selectedListing, isCreating]);

  useEffect(() => {
    if (selectedListing && !isCreating) {
      setListingForm(listingFormFromRecord(selectedListing));
      return;
    }
    setListingForm(EMPTY_LISTING_FORM);
  }, [selectedListing, isCreating]);

  if (!providerId) {
    return <div className="empty-panel">No provider context is attached to this account.</div>;
  }

  const listingItems = listings as any[];
  const activeListings = listingItems.filter((listing) => listing.status === 'active').length;
  const draftListings = listingItems.filter((listing) => listing.status === 'draft' || listing.status === 'pending_review').length;
  const instantBookings = listingItems.filter((listing) => listing.isInstantBooking).length;

  const createOrUpdateListing = useMutation({
    mutationFn: async () => {
      const tags = listingForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
      const basePayload = {
        categoryId: listingForm.categoryId,
        destinationId: listingForm.destinationId,
        type: listingForm.type,
        title: listingForm.title.trim(),
        slug: listingForm.slug.trim(),
        shortDescription: listingForm.shortDescription.trim(),
        description: listingForm.description.trim(),
        basePriceAmount: Number(listingForm.basePriceAmount),
        currencyCode: listingForm.currencyCode.trim().toUpperCase(),
        durationMinutes: toOptionalNumber(listingForm.durationMinutes),
        maxCapacity: toOptionalNumber(listingForm.maxCapacity),
        minGuests: Number(listingForm.minGuests || '1'),
        isInstantBooking: listingForm.isInstantBooking,
        tags,
      };

      if (isCreating) {
        const parsed = createListingSchema.safeParse(basePayload);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid listing');
        return apiClient.providers.createListing(providerId, parsed.data);
      }

      if (!selectedListingId) throw new Error('Select a listing first.');
      const parsed = updateListingSchema.safeParse({
        ...basePayload,
        status: listingForm.status,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid listing update');
      return apiClient.providers.updateListing(providerId, selectedListingId, {
        ...parsed.data,
        status: listingForm.status,
      });
    },
    onSuccess: async (listing: any) => {
      await queryClient.invalidateQueries({ queryKey: ['provider-listings', providerId] });
      if (listing?.id) setSelectedListingId(listing.id);
      setIsCreating(false);
      setMessage(isCreating ? 'Listing created.' : 'Listing updated.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const pricingRuleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListingId) throw new Error('Select a listing first.');
      const payload = {
        name: pricingRuleForm.name.trim(),
        priceAmount: Number(pricingRuleForm.priceAmount),
        currencyCode: pricingRuleForm.currencyCode.trim().toUpperCase(),
        unitType: pricingRuleForm.unitType,
        minUnits: Number(pricingRuleForm.minUnits || '1'),
        maxUnits: toOptionalNumber(pricingRuleForm.maxUnits),
      };
      const parsed = createPricingRuleSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid pricing rule');
      return apiClient.providers.createPricingRule(providerId, selectedListingId, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-listing-management', providerId, selectedListingId] });
      setPricingRuleForm(EMPTY_PRICING_RULE_FORM);
      setMessage('Pricing rule created.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const blackoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListingId) throw new Error('Select a listing first.');
      const payload = {
        date: blackoutForm.date,
        reason: toOptionalTrimmed(blackoutForm.reason),
      };
      const parsed = createBlackoutDateSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid blackout date');
      return apiClient.providers.createBlackoutDate(providerId, selectedListingId, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-listing-management', providerId, selectedListingId] });
      setBlackoutForm(EMPTY_BLACKOUT_FORM);
      setMessage('Blackout date added.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const inventoryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListingId) throw new Error('Select a listing first.');
      const payload = {
        date: inventoryForm.date,
        totalCapacity: Number(inventoryForm.totalCapacity),
        isAvailable: inventoryForm.isAvailable,
      };
      const parsed = updateInventorySchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid inventory update');
      return apiClient.providers.updateInventory(providerId, selectedListingId, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-listing-management', providerId, selectedListingId] });
      setInventoryForm(EMPTY_INVENTORY_FORM);
      setMessage('Inventory updated.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const managementData = management as {
    pricingRules?: any[];
    blackouts?: any[];
    inventory?: any[];
  } | undefined;

  return (
    <div className="domain-page">
      <div className="domain-page-header">
        <div>
          <span className="eyebrow">Provider listings</span>
          <h1 className="page-title">Listing management</h1>
          <p className="page-subtitle">
            Manage your sellable inventory with clear controls for copy, pricing rules, blackout dates, and day-level capacity.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              setIsCreating(true);
              setSelectedListingId(null);
              setListingForm(EMPTY_LISTING_FORM);
              setMessage('Ready to create a new listing.');
              setErrorMessage(null);
            }}
          >
            New listing
          </button>
          <button className="btn-primary" onClick={() => void createOrUpdateListing.mutateAsync()} disabled={createOrUpdateListing.isPending}>
            {createOrUpdateListing.isPending ? 'Saving...' : isCreating ? 'Create listing' : 'Save listing'}
          </button>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Listings" value={listingItems.length} hint={`${activeListings} active in market`} />
        <StatCard label="Drafts" value={draftListings} hint="Listings that still need setup or review" />
        <StatCard label="Instant booking" value={instantBookings} hint="Listings configured for faster confirmation" />
        <StatCard label="Starting price" value={selectedListing ? formatMoney(selectedListing.basePrice?.amount, selectedListing.currencyCode) : 'Select listing'} hint="Price baseline for the selected listing" />
      </div>

      {(message || errorMessage) && (
        <div className={errorMessage ? 'alert-error' : 'alert-success'} style={{ marginBottom: '1rem' }}>
          {errorMessage ?? message}
        </div>
      )}

      <div className="domain-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Listing catalog</h2>
              <p className="section-copy">Select a listing to inspect the commercial setup and operational controls.</p>
            </div>
          </div>

          <div className="list-stack">
            {listingItems.map((listing) => (
              <button
                key={listing.id}
                type="button"
                className={`list-card${selectedListingId === listing.id ? ' selected' : ''}`}
                onClick={() => {
                  setIsCreating(false);
                  setSelectedListingId(listing.id);
                }}
              >
                <strong>{listing.title}</strong>
                <span>{titleizeToken(listing.status)} / {formatMoney(listing.basePrice?.amount, listing.currencyCode)}</span>
              </button>
            ))}
            {listingItems.length === 0 && <div className="empty-panel">No listings have been created yet.</div>}
          </div>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">{isCreating ? 'Create listing' : 'Listing details'}</h2>
              <p className="section-copy">Keep the commercial information clean, clear, and ready for review.</p>
            </div>
            {!isCreating && selectedListing && <span className="badge badge-info">{titleizeToken(selectedListing.status)}</span>}
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Category</span>
              <select value={listingForm.categoryId} onChange={(event) => setListingForm((current) => ({ ...current, categoryId: event.target.value }))}>
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Destination</span>
              <select value={listingForm.destinationId} onChange={(event) => setListingForm((current) => ({ ...current, destinationId: event.target.value }))}>
                <option value="">Select destination</option>
                {destinations.map((destination) => (
                  <option key={destination.id} value={destination.id}>{destination.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Type</span>
              <select value={listingForm.type} onChange={(event) => setListingForm((current) => ({ ...current, type: event.target.value as ListingFormState['type'] }))}>
                <option value="tour">Tour</option>
                <option value="hotel">Hotel</option>
                <option value="rental">Rental</option>
                <option value="transfer">Transfer</option>
                <option value="car">Car</option>
                <option value="package">Package</option>
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select value={listingForm.status} onChange={(event) => setListingForm((current) => ({ ...current, status: event.target.value as ListingFormState['status'] }))}>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending review</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="field field-span-2">
              <span>Title</span>
              <input value={listingForm.title} onChange={(event) => setListingForm((current) => ({ ...current, title: event.target.value }))} placeholder="Sunrise safari over the Mara" />
            </label>
            <label className="field field-span-2">
              <span>Slug</span>
              <input value={listingForm.slug} onChange={(event) => setListingForm((current) => ({ ...current, slug: event.target.value }))} placeholder="sunrise-safari-over-the-mara" />
            </label>
            <label className="field field-span-2">
              <span>Short description</span>
              <textarea value={listingForm.shortDescription} rows={3} onChange={(event) => setListingForm((current) => ({ ...current, shortDescription: event.target.value }))} />
            </label>
            <label className="field field-span-2">
              <span>Description</span>
              <textarea value={listingForm.description} rows={5} onChange={(event) => setListingForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="field">
              <span>Base price</span>
              <input value={listingForm.basePriceAmount} type="number" onChange={(event) => setListingForm((current) => ({ ...current, basePriceAmount: event.target.value }))} />
            </label>
            <label className="field">
              <span>Currency</span>
              <input value={listingForm.currencyCode} maxLength={3} onChange={(event) => setListingForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
            </label>
            <label className="field">
              <span>Duration minutes</span>
              <input value={listingForm.durationMinutes} type="number" onChange={(event) => setListingForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
            </label>
            <label className="field">
              <span>Max capacity</span>
              <input value={listingForm.maxCapacity} type="number" onChange={(event) => setListingForm((current) => ({ ...current, maxCapacity: event.target.value }))} />
            </label>
            <label className="field">
              <span>Min guests</span>
              <input value={listingForm.minGuests} type="number" onChange={(event) => setListingForm((current) => ({ ...current, minGuests: event.target.value }))} />
            </label>
            <label className="field">
              <span>Tags</span>
              <input value={listingForm.tags} onChange={(event) => setListingForm((current) => ({ ...current, tags: event.target.value }))} placeholder="family, premium, wildlife" />
            </label>
          </div>

          <label className="toggle-card" style={{ marginTop: '1rem' }}>
            <input type="checkbox" checked={listingForm.isInstantBooking} onChange={(event) => setListingForm((current) => ({ ...current, isInstantBooking: event.target.checked }))} />
            <span>Instant booking enabled</span>
          </label>
        </section>
      </div>

      <div className="workspace-triptych">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Pricing rules</h2>
              <p className="section-copy">Add commercial pricing options for the currently selected listing.</p>
            </div>
          </div>

          {!selectedListingId || isCreating ? (
            <div className="empty-panel">Select an existing listing to manage its operational controls.</div>
          ) : (
            <>
              <div className="list-stack">
                {(managementData?.pricingRules ?? []).map((rule: any) => (
                  <div key={rule.id} className="list-card static">
                    <strong>{rule.name}</strong>
                    <span>{formatMoney(rule.priceAmount, rule.currencyCode)} / {titleizeToken(rule.unitType)}</span>
                  </div>
                ))}
                {(managementData?.pricingRules ?? []).length === 0 && <div className="empty-panel">No pricing rules configured yet.</div>}
              </div>

              <div className="form-grid">
                <label className="field field-span-2">
                  <span>Name</span>
                  <input value={pricingRuleForm.name} onChange={(event) => setPricingRuleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Peak season adult rate" />
                </label>
                <label className="field">
                  <span>Price</span>
                  <input value={pricingRuleForm.priceAmount} type="number" onChange={(event) => setPricingRuleForm((current) => ({ ...current, priceAmount: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Currency</span>
                  <input value={pricingRuleForm.currencyCode} onChange={(event) => setPricingRuleForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
                </label>
                <label className="field">
                  <span>Unit type</span>
                  <select value={pricingRuleForm.unitType} onChange={(event) => setPricingRuleForm((current) => ({ ...current, unitType: event.target.value as PricingRuleFormState['unitType'] }))}>
                    <option value="per_person">Per person</option>
                    <option value="per_group">Per group</option>
                    <option value="per_night">Per night</option>
                    <option value="per_day">Per day</option>
                    <option value="per_vehicle">Per vehicle</option>
                    <option value="flat">Flat</option>
                  </select>
                </label>
                <label className="field">
                  <span>Min units</span>
                  <input value={pricingRuleForm.minUnits} type="number" onChange={(event) => setPricingRuleForm((current) => ({ ...current, minUnits: event.target.value }))} />
                </label>
              </div>
              <button className="btn-secondary" onClick={() => void pricingRuleMutation.mutateAsync()} disabled={pricingRuleMutation.isPending}>
                {pricingRuleMutation.isPending ? 'Adding...' : 'Add pricing rule'}
              </button>
            </>
          )}
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Blackout dates</h2>
              <p className="section-copy">Block dates that should not be bookable.</p>
            </div>
          </div>

          {!selectedListingId || isCreating ? (
            <div className="empty-panel">Select an existing listing to manage blackout dates.</div>
          ) : (
            <>
              <div className="list-stack">
                {(managementData?.blackouts ?? []).map((blackout: any) => (
                  <div key={blackout.id} className="list-card static">
                    <strong>{formatDate(blackout.date)}</strong>
                    <span>{blackout.reason ?? 'No reason provided'}</span>
                  </div>
                ))}
                {(managementData?.blackouts ?? []).length === 0 && <div className="empty-panel">No blackout dates set.</div>}
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Date</span>
                  <input value={blackoutForm.date} type="date" onChange={(event) => setBlackoutForm((current) => ({ ...current, date: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Reason</span>
                  <input value={blackoutForm.reason} onChange={(event) => setBlackoutForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Maintenance window" />
                </label>
              </div>
              <button className="btn-secondary" onClick={() => void blackoutMutation.mutateAsync()} disabled={blackoutMutation.isPending}>
                {blackoutMutation.isPending ? 'Adding...' : 'Add blackout date'}
              </button>
            </>
          )}
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Inventory</h2>
              <p className="section-copy">Update date-level availability and capacity for the selected listing.</p>
            </div>
          </div>

          {!selectedListingId || isCreating ? (
            <div className="empty-panel">Select an existing listing to manage inventory.</div>
          ) : (
            <>
              <div className="list-stack">
                {(managementData?.inventory ?? []).slice(0, 6).map((slot: any) => (
                  <div key={slot.id} className="list-card static">
                    <strong>{formatDate(slot.date)}</strong>
                    <span>{slot.remainingCapacity} remaining / {slot.isAvailable ? 'Available' : 'Closed'}</span>
                  </div>
                ))}
                {(managementData?.inventory ?? []).length === 0 && <div className="empty-panel">No inventory records set yet.</div>}
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Date</span>
                  <input value={inventoryForm.date} type="date" onChange={(event) => setInventoryForm((current) => ({ ...current, date: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Total capacity</span>
                  <input value={inventoryForm.totalCapacity} type="number" onChange={(event) => setInventoryForm((current) => ({ ...current, totalCapacity: event.target.value }))} />
                </label>
              </div>
              <label className="toggle-card" style={{ marginBottom: '1rem' }}>
                <input type="checkbox" checked={inventoryForm.isAvailable} onChange={(event) => setInventoryForm((current) => ({ ...current, isAvailable: event.target.checked }))} />
                <span>Available for booking</span>
              </label>
              <button className="btn-secondary" onClick={() => void inventoryMutation.mutateAsync()} disabled={inventoryMutation.isPending}>
                {inventoryMutation.isPending ? 'Updating...' : 'Update inventory'}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
