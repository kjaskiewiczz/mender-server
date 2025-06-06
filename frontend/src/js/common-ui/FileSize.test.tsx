// Copyright 2024 Northern.tech AS
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
import React from 'react';

import { deepCompare } from '@northern.tech/utils/helpers';
import { render } from '@testing-library/react';

import { undefineds } from '../../../tests/mockData';
import FileSize from './FileSize';

describe('FileSize Component', () => {
  it('renders correctly', async () => {
    const { baseElement } = render(<FileSize fileSize={1000} />);
    const view = baseElement.firstChild.firstChild;
    expect(view).toMatchSnapshot();
    expect(view).toEqual(expect.not.stringMatching(undefineds));
    expect(deepCompare(<FileSize fileSize={100} />, <FileSize fileSize={100} />)).toBeTruthy();
    expect(deepCompare(<FileSize fileSize={100} />, <FileSize fileSize={200} />)).toBeFalsy();
  });
});
