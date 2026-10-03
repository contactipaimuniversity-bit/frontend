import type { Application } from './types';

export function getAcceptedApplicationsForEnrollment(
  applications: Application[] | null | undefined,
): Application[];
