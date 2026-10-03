function getAcceptedApplicationsForEnrollment(applications) {
  return applications.filter((application) => application?.statut === 'ACCEPTEE');
}

module.exports = {
  getAcceptedApplicationsForEnrollment,
};
