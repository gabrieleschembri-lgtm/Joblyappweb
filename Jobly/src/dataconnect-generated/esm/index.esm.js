import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'jobly',
  location: 'us-central1'
};

export const listAllJobsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllJobs');
}
listAllJobsRef.operationName = 'ListAllJobs';

export function listAllJobs(dc) {
  return executeQuery(listAllJobsRef(dc));
}

export const createNewJobRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNewJob', inputVars);
}
createNewJobRef.operationName = 'CreateNewJob';

export function createNewJob(dcOrVars, vars) {
  return executeMutation(createNewJobRef(dcOrVars, vars));
}

export const getUserApplicationsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserApplications', inputVars);
}
getUserApplicationsRef.operationName = 'GetUserApplications';

export function getUserApplications(dcOrVars, vars) {
  return executeQuery(getUserApplicationsRef(dcOrVars, vars));
}

export const applyToJobRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ApplyToJob', inputVars);
}
applyToJobRef.operationName = 'ApplyToJob';

export function applyToJob(dcOrVars, vars) {
  return executeMutation(applyToJobRef(dcOrVars, vars));
}

