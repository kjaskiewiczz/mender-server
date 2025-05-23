// Copyright 2015 Northern.tech AS
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import Loader from '@northern.tech/common-ui/Loader';
import storeActions from '@northern.tech/store/actions';
import { DEPLOYMENT_ROUTES, DEPLOYMENT_STATES, TIMEOUTS, deploymentDisplayStates, onboardingSteps } from '@northern.tech/store/constants';
import {
  DEPLOYMENT_CUTOFF,
  getDevicesById,
  getIdAttribute,
  getOnboardingState,
  getRecentDeployments,
  getUserCapabilities
} from '@northern.tech/store/selectors';
import { getDeploymentsByStatus } from '@northern.tech/store/thunks';
import { useWindowSize } from '@northern.tech/utils/resizehook';
import { clearAllRetryTimers, setRetryTimer } from '@northern.tech/utils/retrytimer';

import { getOnboardingComponentFor } from '../../utils/onboardingManager';
import { BaseDeploymentsWidget, CompletedDeployments } from './widgets/Deployments';
import RedirectionWidget from './widgets/RedirectionWidget';

const { setSnackbar } = storeActions;

const refreshDeploymentsLength = 30000;

// we need to exclude the scheduled state here as the os version is not able to process these and would prevent the dashboard from loading
const stateMap = {
  [DEPLOYMENT_STATES.pending]: BaseDeploymentsWidget,
  [DEPLOYMENT_STATES.inprogress]: BaseDeploymentsWidget,
  [DEPLOYMENT_STATES.finished]: CompletedDeployments
};

export const Deployments = ({ className = '', clickHandle }) => {
  const dispatch = useDispatch();
  const setSnackbarDispatched = useCallback(message => dispatch(setSnackbar(message)), [dispatch]);
  const { canDeploy } = useSelector(getUserCapabilities);
  const { total: deploymentsCount, ...deployments } = useSelector(getRecentDeployments);
  const onboardingState = useSelector(getOnboardingState);
  const devicesById = useSelector(getDevicesById);
  const idAttribute = useSelector(getIdAttribute);
  const [loading, setLoading] = useState(!deploymentsCount);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const size = useWindowSize();
  const deploymentsRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>();
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>();

  const getDeployments = useCallback(
    () =>
      Promise.all(Object.keys(stateMap).map(status => dispatch(getDeploymentsByStatus({ status, page: 1, perPage: DEPLOYMENT_CUTOFF }))))
        .catch(err => setRetryTimer(err, 'deployments', `Couldn't load deployments.`, refreshDeploymentsLength, setSnackbarDispatched))
        .finally(() => setLoading(false)),
    [dispatch, setSnackbarDispatched]
  );

  useEffect(() => {
    clearAllRetryTimers(setSnackbarDispatched);
    clearInterval(timer.current);
    timer.current = setInterval(getDeployments, refreshDeploymentsLength);
    getDeployments();
    return () => {
      clearInterval(timer.current);
      clearAllRetryTimers(setSnackbarDispatched);
    };
  }, [getDeployments, setSnackbarDispatched]);

  useEffect(() => {
    timeoutTimer.current = setTimeout(() => setLoading(false), TIMEOUTS.debounceDefault);
    return () => clearTimeout(timeoutTimer.current);
  }, []);

  let onboardingComponent;
  if (deploymentsRef.current) {
    const anchor = {
      top: deploymentsRef.current.offsetTop + deploymentsRef.current.offsetHeight,
      left: deploymentsRef.current.offsetLeft + deploymentsRef.current.offsetWidth / 2
    };
    onboardingComponent = getOnboardingComponentFor(onboardingSteps.DEPLOYMENTS_PAST_COMPLETED, onboardingState, { anchor });
  }
  return (
    <div className={`${className} deployments`}>
      {loading ? (
        <Loader show={loading} fade={true} />
      ) : (
        <div className="dashboard flexbox column" ref={deploymentsRef} style={{ gridTemplateColumns: '1fr', rowGap: 10 }}>
          <h4 className={`${deploymentsCount ? 'margin-bottom-none' : 'margin-top-none'} margin-left-small`}>
            {deploymentsCount ? 'Recent deployments' : 'Deployments'}
          </h4>
          {deploymentsCount ? (
            <>
              {Object.entries(stateMap).reduce((accu, [key, Component]) => {
                if (!deployments[key]) {
                  return accu;
                }
                accu.push(
                  <React.Fragment key={key}>
                    <h5 className="margin-bottom-none">{deploymentDisplayStates[key]}</h5>
                    <Component deployments={deployments[key]} devicesById={devicesById} idAttribute={idAttribute} state={key} onClick={clickHandle} />
                  </React.Fragment>
                );
                return accu;
              }, [])}
              <Link className="margin-top margin-bottom-large" to="/deployments">
                See all deployments
              </Link>
            </>
          ) : (
            canDeploy && (
              <RedirectionWidget
                content="Create a new deployment to update a group of devices"
                onClick={() => clickHandle({ route: `${DEPLOYMENT_ROUTES.active.route}?open=true` })}
              />
            )
          )}
        </div>
      )}
      {onboardingComponent}
    </div>
  );
};

export default Deployments;
