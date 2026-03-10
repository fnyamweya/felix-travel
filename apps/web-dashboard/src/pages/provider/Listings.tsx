import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBlackoutDateSchema,
  createListingSchema,
  createPricingRuleSchema,
  updateInventorySchema,
  updateListingSchema,
} from '@felix-travel/validation';
import { CircleDollarSign, Clock3, ListChecks, TicketCheck } from 'lucide-react';
import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@felix-travel/ui';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, getErrorMessage, titleizeToken, toOptionalNumber, toOptionalTrimmed } from '../../lib/admin-utils.js';
import {
  EmptyBlock,
  Field,
  FieldGrid,
  InfoCard,
  InfoGrid,
  Notice,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatGrid,
  SwitchField,
  TextField,
  TextareaField,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

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
    return (
      <PageShell>
        <EmptyBlock
          title="No provider context is attached to this account."
          description="Assign a provider to manage listings."
        />
      </PageShell>
    );
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
    <PageShell>
      <PageHeader
        eyebrow="Provider listings"
        title="Listing management"
        description="Manage inventory, pricing, blackouts, and capacity."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(true);
                setSelectedListingId(null);
                setListingForm(EMPTY_LISTING_FORM);
                setMessage('Ready to create a new listing.');
                setErrorMessage(null);
              }}
            >
              New listing
            </Button>
            <Button onClick={() => void createOrUpdateListing.mutateAsync()} loading={createOrUpdateListing.isPending}>
              {isCreating ? 'Create listing' : 'Save listing'}
            </Button>
          </>
        }
      />

      {(message || errorMessage) ? (
        <Notice message={errorMessage ?? message ?? ''} variant={errorMessage ? 'destructive' : 'success'} />
      ) : null}

      <StatGrid>
        <StatCard label="Listings" value={listingItems.length} hint={`${activeListings} active in market`} icon={ListChecks} />
        <StatCard label="Drafts" value={draftListings} hint="Listings that still need setup or review" icon={Clock3} tone="warning" />
        <StatCard label="Instant booking" value={instantBookings} hint="Listings configured for faster confirmation" icon={TicketCheck} tone="success" />
        <StatCard label="Starting price" value={selectedListing ? formatMoney(selectedListing.basePrice?.amount, selectedListing.currencyCode) : 'Select listing'} hint="Base price for the active listing" icon={CircleDollarSign} tone="info" />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard
            title="Listing catalog"
            description="Select a listing to manage setup and pricing."
          >
            <div className="space-y-3">
              {listingItems.map((listing) => (
                <button
                  key={listing.id}
                  type="button"
                  className={selectedListingId === listing.id ? 'rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 text-left' : 'rounded-2xl border border-border/60 bg-background px-4 py-4 text-left hover:bg-muted/35'}
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedListingId(listing.id);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{listing.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{formatMoney(listing.basePrice?.amount, listing.currencyCode)}</div>
                    </div>
                    <Badge variant={listing.status === 'active' ? 'success' : listing.status === 'pending_review' ? 'warning' : 'secondary'}>
                      {titleizeToken(listing.status)}
                    </Badge>
                  </div>
                </button>
              ))}
              {listingItems.length === 0 && (
                <EmptyBlock title="No listings created yet" description="Create your first listing to start managing pricing and availability." />
              )}
            </div>
          </SectionCard>
        }
        side={
          <SectionCard
            title={isCreating ? 'Create listing' : 'Listing details'}
            description="Keep the listing profile complete and ready."
          >
            <div className="space-y-6">
              <FieldGrid>
                <Field label="Category">
                  <Select value={listingForm.categoryId || '__none'} onValueChange={(value) => setListingForm((current) => ({ ...current, categoryId: value === '__none' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Select category</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Destination">
                  <Select value={listingForm.destinationId || '__none'} onValueChange={(value) => setListingForm((current) => ({ ...current, destinationId: value === '__none' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Select destination</SelectItem>
                      {destinations.map((destination) => (
                        <SelectItem key={destination.id} value={destination.id}>{destination.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Type">
                  <Select value={listingForm.type} onValueChange={(value) => setListingForm((current) => ({ ...current, type: value as ListingFormState['type'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tour">Tour</SelectItem>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="rental">Rental</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="package">Package</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={listingForm.status} onValueChange={(value) => setListingForm((current) => ({ ...current, status: value as ListingFormState['status'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending_review">Pending review</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <TextField label="Title" className="md:col-span-2" value={listingForm.title} onChange={(event) => setListingForm((current) => ({ ...current, title: event.target.value }))} placeholder="Sunrise safari over the Mara" />
                <TextField label="Slug" className="md:col-span-2" value={listingForm.slug} onChange={(event) => setListingForm((current) => ({ ...current, slug: event.target.value }))} placeholder="sunrise-safari-over-the-mara" />
                <TextareaField label="Short description" className="md:col-span-2" rows={3} value={listingForm.shortDescription} onChange={(event) => setListingForm((current) => ({ ...current, shortDescription: event.target.value }))} />
                <TextareaField label="Description" className="md:col-span-2" rows={5} value={listingForm.description} onChange={(event) => setListingForm((current) => ({ ...current, description: event.target.value }))} />
                <TextField label="Base price" type="number" value={listingForm.basePriceAmount} onChange={(event) => setListingForm((current) => ({ ...current, basePriceAmount: event.target.value }))} />
                <TextField label="Currency" value={listingForm.currencyCode} maxLength={3} onChange={(event) => setListingForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
                <TextField label="Duration minutes" type="number" value={listingForm.durationMinutes} onChange={(event) => setListingForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
                <TextField label="Max capacity" type="number" value={listingForm.maxCapacity} onChange={(event) => setListingForm((current) => ({ ...current, maxCapacity: event.target.value }))} />
                <TextField label="Min guests" type="number" value={listingForm.minGuests} onChange={(event) => setListingForm((current) => ({ ...current, minGuests: event.target.value }))} />
                <TextField label="Tags" value={listingForm.tags} onChange={(event) => setListingForm((current) => ({ ...current, tags: event.target.value }))} placeholder="family, premium, wildlife" />
              </FieldGrid>

              <SwitchField label="Instant booking enabled" description="Enable faster confirmation when on sale." checked={listingForm.isInstantBooking} onCheckedChange={(value) => setListingForm((current) => ({ ...current, isInstantBooking: value }))} />

              {!isCreating && selectedListing ? (
                <InfoGrid>
                  <InfoCard label="Listing status" value={titleizeToken(selectedListing.status)} />
                  <InfoCard label="Starting price" value={formatMoney(selectedListing.basePrice?.amount, selectedListing.currencyCode)} />
                </InfoGrid>
              ) : null}
            </div>
          </SectionCard>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Pricing rules"
          description="Add pricing variants for the selected listing."
        >
          {!selectedListingId || isCreating ? (
            <EmptyBlock title="Select an existing listing" description="Available after the listing is created." />
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                {(managementData?.pricingRules ?? []).map((rule: any) => (
                  <div key={rule.id} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                    <div className="text-sm font-semibold text-foreground">{rule.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{formatMoney(rule.priceAmount, rule.currencyCode)} / {titleizeToken(rule.unitType)}</div>
                  </div>
                ))}
                {(managementData?.pricingRules ?? []).length === 0 && (
                  <EmptyBlock title="No pricing rules configured" description="Add a rule for unit-based pricing." />
                )}
              </div>
              <FieldGrid>
                <TextField label="Name" className="md:col-span-2" value={pricingRuleForm.name} onChange={(event) => setPricingRuleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Peak season adult rate" />
                <TextField label="Price" type="number" value={pricingRuleForm.priceAmount} onChange={(event) => setPricingRuleForm((current) => ({ ...current, priceAmount: event.target.value }))} />
                <TextField label="Currency" value={pricingRuleForm.currencyCode} onChange={(event) => setPricingRuleForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
                <Field label="Unit type">
                  <Select value={pricingRuleForm.unitType} onValueChange={(value) => setPricingRuleForm((current) => ({ ...current, unitType: value as PricingRuleFormState['unitType'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select unit type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_person">Per person</SelectItem>
                      <SelectItem value="per_group">Per group</SelectItem>
                      <SelectItem value="per_night">Per night</SelectItem>
                      <SelectItem value="per_day">Per day</SelectItem>
                      <SelectItem value="per_vehicle">Per vehicle</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <TextField label="Min units" type="number" value={pricingRuleForm.minUnits} onChange={(event) => setPricingRuleForm((current) => ({ ...current, minUnits: event.target.value }))} />
                <TextField label="Max units" type="number" className="md:col-span-2" value={pricingRuleForm.maxUnits} onChange={(event) => setPricingRuleForm((current) => ({ ...current, maxUnits: event.target.value }))} />
              </FieldGrid>
              <Button variant="outline" onClick={() => void pricingRuleMutation.mutateAsync()} loading={pricingRuleMutation.isPending}>
                Add pricing rule
              </Button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Blackout dates"
          description="Block non-bookable dates for this listing."
        >
          {!selectedListingId || isCreating ? (
            <EmptyBlock title="Select an existing listing" description="Available after the listing is created." />
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                {(managementData?.blackouts ?? []).map((blackout: any) => (
                  <div key={blackout.id} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                    <div className="text-sm font-semibold text-foreground">{formatDate(blackout.date)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{blackout.reason ?? 'No reason provided'}</div>
                  </div>
                ))}
                {(managementData?.blackouts ?? []).length === 0 && (
                  <EmptyBlock title="No blackout dates set" description="Block dates for maintenance or closures." />
                )}
              </div>
              <FieldGrid>
                <TextField label="Date" type="date" value={blackoutForm.date} onChange={(event) => setBlackoutForm((current) => ({ ...current, date: event.target.value }))} />
                <TextField label="Reason" value={blackoutForm.reason} onChange={(event) => setBlackoutForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Maintenance window" />
              </FieldGrid>
              <Button variant="outline" onClick={() => void blackoutMutation.mutateAsync()} loading={blackoutMutation.isPending}>
                Add blackout date
              </Button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Inventory"
          description="Set date-level availability and capacity."
        >
          {!selectedListingId || isCreating ? (
            <EmptyBlock title="Select an existing listing" description="Available after the listing is created." />
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                {(managementData?.inventory ?? []).slice(0, 6).map((slot: any) => (
                  <div key={slot.id} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                    <div className="text-sm font-semibold text-foreground">{formatDate(slot.date)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{slot.remainingCapacity} remaining / {slot.isAvailable ? 'Available' : 'Closed'}</div>
                  </div>
                ))}
                {(managementData?.inventory ?? []).length === 0 && (
                  <EmptyBlock title="No inventory records set" description="Add capacity records to control availability." />
                )}
              </div>
              <FieldGrid>
                <TextField label="Date" type="date" value={inventoryForm.date} onChange={(event) => setInventoryForm((current) => ({ ...current, date: event.target.value }))} />
                <TextField label="Total capacity" type="number" value={inventoryForm.totalCapacity} onChange={(event) => setInventoryForm((current) => ({ ...current, totalCapacity: event.target.value }))} />
              </FieldGrid>
              <SwitchField label="Available for booking" description="Allow bookings on the selected date." checked={inventoryForm.isAvailable} onCheckedChange={(value) => setInventoryForm((current) => ({ ...current, isAvailable: value }))} />
              <Button variant="outline" onClick={() => void inventoryMutation.mutateAsync()} loading={inventoryMutation.isPending}>
                Update inventory
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}
