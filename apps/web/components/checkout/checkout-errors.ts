export function resolveCheckoutErrorMessage(
  checkoutErrorMessage: string | null | undefined,
  installmentLaunchError: string | null | undefined,
): string | null {
  if (checkoutErrorMessage) {
    return checkoutErrorMessage;
  }

  if (installmentLaunchError) {
    return installmentLaunchError;
  }

  return null;
}

export function shouldShowCheckoutErrorToast(
  nextErrorMessage: string | null,
  lastErrorToastMessage: string | null,
): boolean {
  return Boolean(nextErrorMessage) && nextErrorMessage !== lastErrorToastMessage;
}
