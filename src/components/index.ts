/**
 * components/index.ts
 * Barrel export para todos os componentes reutilizáveis
 */

// ============================================================================
// CORE COMPONENTS
// ============================================================================

export { default as MetricCard } from './MetricCard';
export type { MetricCardProps } from './MetricCard';
export { METRIC_COLORS, MetricCardVariant } from './MetricCard';
export type { MetricColor } from './MetricCard';

export { default as QuickAction } from './QuickAction';
export type { QuickActionProps } from './QuickAction';
export { QUICK_ACTION_COLORS, QuickActionVariant } from './QuickAction';
export type { QuickActionColor } from './QuickAction';

export { default as SyncIndicator } from './SyncIndicator';
export type { SyncIndicatorProps } from './SyncIndicator';
export { SyncBadge, SyncStatusCard } from './SyncIndicator';

// ============================================================================
// FEEDBACK COMPONENTS
// ============================================================================

export { default as Loading } from './Loading';
export type { LoadingProps } from './Loading';
export { LoadingInline } from './Loading';

export { default as ErrorScreen } from './ErrorScreen';
export type { ErrorScreenProps } from './ErrorScreen';
export { ErrorInline } from './ErrorScreen';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { EmptyStateSimple } from './EmptyState';

// ============================================================================
// INPUT COMPONENTS
// ============================================================================

export { default as SearchBar } from './SearchBar';
export type { SearchBarProps } from './SearchBar';
export { SearchBarCompact } from './SearchBar';

export { default as StatusBadge } from './StatusBadge';
export type { StatusBadgeProps } from './StatusBadge';
export { StatusDot } from './StatusBadge';
export { default as FilterChip } from './FilterChip';
export type { FilterChipProps } from './FilterChip';
export { FilterChipGroup } from './FilterChip';
export type { FilterChipGroupProps } from './FilterChip';

export { default as ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

// ============================================================================
// FORM COMPONENTS
// ============================================================================

export { default as FormInput } from './forms/FormInput';
export type { FormInputProps } from './forms/FormInput';
export { FormNumberInput, FormEmailInput, FormPhoneInput, FormDocumentoInput } from './forms/FormInput';

export { default as FormSelect } from './forms/FormSelect';
export type { FormSelectProps, SelectOption } from './forms/FormSelect';
export { FormRadioSelect } from './forms/FormSelect';

export { default as FormDatePicker } from './forms/FormDatePicker';
export type { FormDatePickerProps } from './forms/FormDatePicker';
export { FormTimePicker } from './forms/FormDatePicker';

export { default as FormSection } from './forms/FormSection';
export type { FormSectionProps } from './forms/FormSection';
export { FormSectionCard } from './forms/FormSection';

export { default as FormActions } from './forms/FormActions';
export type { FormActionsProps } from './forms/FormActions';
export { FormSubmitButton } from './forms/FormActions';

// ============================================================================
// CARD COMPONENTS
// ============================================================================

export { default as ClienteCard } from './cards/ClienteCard';
export type { ClienteCardProps } from './cards/ClienteCard';
export { ClienteCardCompact } from './cards/ClienteCard';

export { default as ProdutoCard } from './cards/ProdutoCard';
export type { ProdutoCardProps } from './cards/ProdutoCard';
export { ProdutoEstoqueCard } from './cards/ProdutoCard';

export { default as LocacaoCard } from './cards/LocacaoCard';
export type { LocacaoCardProps } from './cards/LocacaoCard';
export { LocacaoResumoCard } from './cards/LocacaoCard';

export { default as CobrancaCard } from './cards/CobrancaCard';export type { CobrancaCardProps } from './cards/CobrancaCard';

// ============================================================================
// BRANDING
// ============================================================================

export { default as BrandingProvider } from './BrandingProvider';
export { useBranding, usePrimaryColor, useSecondaryColor, useAppName } from './BrandingProvider';