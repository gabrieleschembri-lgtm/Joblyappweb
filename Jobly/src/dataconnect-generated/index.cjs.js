const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'jobly',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const listAllJobsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllJobs');
}
listAllJobsRef.operationName = 'ListAllJobs';
exports.listAllJobsRef = listAllJobsRef;

exports.listAllJobs = function listAllJobs(dc) {
  return executeQuery(listAllJobsRef(dc));
};

const createNewJobRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNewJob', inputVars);
}
createNewJobRef.operationName = 'CreateNewJob';
exports.createNewJobRef = createNewJobRef;

exports.createNewJob = function createNewJob(dcOrVars, vars) {
  return executeMutation(createNewJobRef(dcOrVars, vars));
};

const getUserApplicationsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserApplications', inputVars);
}
getUserApplicationsRef.operationName = 'GetUserApplications';
exports.getUserApplicationsRef = getUserApplicationsRef;

exports.getUserApplications = function getUserApplications(dcOrVars, vars) {
  return executeQuery(getUserApplicationsRef(dcOrVars, vars));
};

const applyToJobRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ApplyToJob', inputVars);
}
applyToJobRef.operationName = 'ApplyToJob';
exports.applyToJobRef = applyToJobRef;

exports.applyToJob = function applyToJob(dcOrVars, vars) {
  return executeMutation(applyToJobRef(dcOrVars, vars));
};
