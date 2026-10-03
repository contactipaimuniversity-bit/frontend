import test from 'node:test';
import assert from 'node:assert/strict';
import enrollmentEligibility from './enrollment-eligibility.js';

const { getAcceptedApplicationsForEnrollment } = enrollmentEligibility;

test('keeps only accepted scholarship applications for enrollment', () => {
  const applications = [
    { id: 'a1', statut: 'ACCEPTEE' },
    { id: 'a2', statut: 'EN_DELIBERATION' },
    { id: 'a3', statut: 'REFUSEE' },
    { id: 'a4', statut: 'ACCEPTEE' },
  ];

  assert.deepStrictEqual(getAcceptedApplicationsForEnrollment(applications), [
    { id: 'a1', statut: 'ACCEPTEE' },
    { id: 'a4', statut: 'ACCEPTEE' },
  ]);
});

