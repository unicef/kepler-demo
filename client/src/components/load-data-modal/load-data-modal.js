// Copyright (c) 2018 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import React, { Component } from 'react';
import { connect } from 'react-redux';
import classnames from 'classnames';
import styled, { ThemeProvider } from 'styled-components';
import PropTypes from 'prop-types';
import { FileUpload } from 'kepler.gl/components';
import { LoadingSpinner } from 'kepler.gl/components';
import { themeLT } from 'kepler.gl/styles';
import { Icons } from 'kepler.gl/components';
import shortid from 'shortid';
import { addDataToMap } from 'kepler.gl/actions';
import * as topojson from 'topojson-client';
import { LOADING_METHODS, QUERY_TYPES } from '../../constants/default-settings';
import Processors from 'kepler.gl/processors';
import KeplerGlSchema from 'kepler.gl/schemas';
// import config from '../../../config';
import CountryShapefileSelect from './country-shapefile-select';
import SampleMapGallery from './sample-map-gallery';
import { shapefileHashEnglish } from './english-shapefile-hash';
let config = require('./layers/base')
let layerSchools = require('./layers/schools')
let layerHealthsites = require('./layers/healthsites')
let layerBorderFile = require('./layers/borderfile')


const propTypes = {
  // query options
  loadingMethod: PropTypes.object.isRequired,
  currentOption: PropTypes.object.isRequired,
  sampleMaps: PropTypes.array.isRequired,

  // call backs
  onFileUpload: PropTypes.func.isRequired,
  onLoadSampleData: PropTypes.func.isRequired,
  onSetLoadingMethod: PropTypes.func.isRequired
};

const BackLink = styled.div`
  display: flex;
  font-size: 14px;
  align-items: center;
  color: ${props => props.theme.titleColorLT};
  cursor: pointer;
  margin-bottom: 40px;

  :hover {
    font-weight: 500;
  }

  span {
    white-space: nowrap;
  }
  svg {
    margin-right: 10px;
  }
`;

const ShapeFile = styled.div`
  hr {
    margin-top: 40px;
  }

  p {
    font-size: 13px;
    color: #29323C;
  }
`;

const ModalTab = styled.div`
  align-items: flex-end;
  display: flex;
  border-bottom: 1px solid #d8d8d8;
  margin-bottom: 32px;
  justify-content: space-between;

  .load-data-modal__tab__inner {
    display: flex;
  }
  .load-data-modal__tab__item {
    border-bottom: 3px solid transparent;
    cursor: pointer;
    margin-left: 32px;
    padding: 16px 0;
    font-size: 14px;
    font-weight: 400;
    color: ${props => props.theme.subtextColorLT};

    :first-child {
      margin-left: 0;
      padding-left: 0;
    }

    :hover {
      color: ${props => props.theme.textColorLT};
    }
  }

  .load-data-modal__tab__item.active {
    color: ${props => props.theme.textColorLT};
    border-bottom: 3px solid ${props => props.theme.textColorLT};
    font-weight: 500;
  }
`;

/* this is the thumbnail next to the "Click here to access sample maps/data" button */
// const StyledMapIcon = styled.div`
//   background-image: url("${ASSETS_URL}icon-demo-map.jpg");
//   background-repeat: no-repeat;
//   background-size: 64px 48px;
//   width: 64px;
//   height: 48px;
//   border-radius: 2px;
// `;

const StyledTrySampleData = styled.div`
  display: flex;
  margin-bottom: 12px;

  .demo-map-title {
    margin-left: 16px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .demo-map-label {
    font-size: 11px;
    color: ${props => props.theme.labelColorLT};
  }

  .demo-map-action {
    display: flex;
    font-size: 14px;
    align-items: center;
    color: ${props => props.theme.titleColorLT};
    cursor: pointer;

    :hover {
      font-weight: 500;
    }

    span {
      white-space: nowrap;
    }
    svg {
      margin-left: 10px;
    }
  }
`;

const StyledSpinner = styled.div`
  text-align: center;
  span {
    margin: 0 auto;
  }
`;

const generateAdminLevels = (deepestLevel) => {
  // parse int to ensure the value passed in Array() is a number; else, the function won't work properly.
  // if deepestLevel is, say, 3, the function will give us array [0, 1, 2, 3]
  let adminLevels = [...Array(parseInt(deepestLevel, 10) + 1).keys()]
    .map(value => {
      return { adminLevel: value, id: shortid.generate() };
    });
  return adminLevels;
};

const getSelectedValue = (menu) => {
  return menu.options[menu.selectedIndex].value;
};

const client_url = window.location.origin; // will be something like http://localhost:8080

class LoadDataModal extends Component {

  state = {
    adminList: [],
    countryAndAdminList: [],
    countrySelected: false,
    isShapefileListLoading: true,
    submitReady: false
  }

  handleCountryChange = (event) => {
    let code = event.target.value;
    if (code !== "") {
      let country = this.state.countryAndAdminList.find(e => e.countryCode === code);
      let maxAdmin = parseInt(country.adminLevel, 10);
      let adminList = generateAdminLevels(maxAdmin);
      this.setState({
        adminList: adminList,
        countrySelected: true
      });
    } else {
      this.setState({
        adminList: [],
        countrySelected: false,
        submitReady: false
      });
    }
  }

  handleAdminChange = (event) => {
    let admin = event.target.value;
    if (admin !== "") this.setState({ submitReady: true });
    else this.setState({ submitReady: false });
  }

  handleShapefileChoice = (event) => {
    event.preventDefault();
    let form = event.target;
    let countryDD = form.elements["country-select"];
    let adminDD = form.elements["admin-select"];
    let countryCode = getSelectedValue(countryDD);
    let adminLevel = getSelectedValue(adminDD);
    let getHealthSites = form.elements["get-health-sites"].checked;
    let getSchools = form.elements["get-schools"].checked;
    fetch(`/api/shapefiles/countries/${countryCode}/${adminLevel}?healthsites=${getHealthSites}&schools=${getSchools}`)
    .then(res => res.json())
    .then(t => {
      this.uploadShapefiles(t.shapedata, countryCode, adminLevel);
      if (getHealthSites) {
        let id = `healthsites-${countryCode}`;
        let label = `healthsites-${countryCode}`;
        this.uploadCSVData (t.healthsites, id, label);
      }
      if (getSchools) {
        let id = `schools-${countryCode}`;
        let label = `schools-${countryCode}`;
        this.uploadCSVData (t.schools, id, label);
      }
    })
    .catch(err => console.log(err));
  }

  uploadShapefiles = (shapedata, countryCode, adminLevel) => {
    let geojson = topojson.feature(shapedata, shapedata.objects[countryCode + '_' + adminLevel]);
    const dataset = {
      info: {
        id: `borderfile-${countryCode}-${adminLevel}`,
        label: `borderfile ${countryCode} L-${adminLevel}`
      },
      data: Processors.processGeojson(geojson)
    };
    if (this.props.demo.keplerGl.map.visState.datasets) {

    }
    let datasets = [dataset]
    console.log(dataset)
    let setslength = Object.keys(this.props.demo.keplerGl.map.visState.datasets).length
    let i = 0
    // Object.keys(this.props.demo.keplerGl.map.visState.datasets).forEach(k => {
    while (i < setslength) {
      let temp = this.props.demo.keplerGl.map.visState.datasets[Object.keys(this.props.demo.keplerGl.map.visState.datasets)[i]]
      i++
//       console.log(k)
//       console.log(temp[k].data)
// console.log(temp[k].allData)
      let obj = {
        info: {
          id: temp.id,
          label: temp.label
        },
        data: {
          fields: temp.fields,
          rows: temp.data
        }
      }
      console.log(obj)
      datasets.push(obj)

    }
    // })
    console.log(datasets)
    layerHealthsites.config.dataId = `healthsites-${countryCode}`
    layerHealthsites.config.label = `healthsites-${countryCode}`
    layerSchools.config.dataId = `schools-${countryCode}`
    layerSchools.config.label = `schools-${countryCode}`
    layerSchools.id = `${countryCode.toLowerCase()}` + `${parseInt(Math.random(1) *10)}` + `${parseInt(Math.random(1) *10)}` + `${parseInt(Math.random(1) *10)}` + `${parseInt(Math.random(1) *10)}`
    layerBorderFile.config.dataId = `borderfile-${countryCode}-${adminLevel}`
    layerBorderFile.config.label = `borderfile ${countryCode} L-${adminLevel}`

    // console.log(this.props.demo.keplerGL.map)
    let tempConfig = KeplerGlSchema.getConfigToSave(this.props.demo.keplerGl.map)
    // tempDatsets = this.props.demo.keplerGl.visState.datasets

        // this.props.dispatch(addDataToMap({datasets: dataset}));
    // console.log(tempConfig)
    // let layers = [layerHealthsites, layerSchools, layerBorderFile]
    config.config.visState.layers = tempConfig.config.visState.layers
    config.config.visState.layers.push(layerHealthsites)
    config.config.visState.layers.push(layerSchools)
    config.config.visState.layers.push(layerBorderFile)

    this.props.dispatch(addDataToMap({datasets, config}));
  }

  uploadCSVData = (healthdata, id, label) => {
    let dataset = {
      info: {
        id: id,
        label: label
      },
      data: Processors.processCsvData(healthdata)
    }
    this.props.dispatch(addDataToMap({datasets: dataset}));
  };

  componentDidMount() {
    fetch('/api/shapefiles/countries')
      .then(res => res.json())
      .then(result => {
        let resultWithIds = result.map(entry => {
          return {
            ...entry,
            countryName: shapefileHashEnglish[(entry.countryCode).toLowerCase()] || entry.countryCode, // in case there's not a matched proper name
            id: shortid.generate()
          };
        });
        resultWithIds.sort((a, b) => {
          let codeA = a.countryName.toLowerCase();
          let codeB = b.countryName.toLowerCase();
          if (codeA > codeB) return 1;
          if (codeA < codeB) return -1;
          return 0;
        });
        // console.log('sorted result', resultWithIds);
        this.setState({
          countryAndAdminList: resultWithIds,
          isShapefileListLoading: false
        });
      }).catch(err => console.log(err));
  }


  render() {
    const { loadingMethod, currentOption, previousMethod, sampleMaps, isMapLoading } = this.props;
    return (
      <ThemeProvider theme={themeLT}>
        <div className="load-data-modal">
          {isMapLoading ? (
            <StyledSpinner>
              <LoadingSpinner />
            </StyledSpinner>
          ) : (
              <div>
                {loadingMethod.id !== 'upload' ? (
                  <Tabs
                    method={loadingMethod.id}
                    toggleMethod={this.props.onSetLoadingMethod}
                  />
                ) : null}
                {loadingMethod.id === 'upload' ? (
                  <div>
                    <BackLink onClick={() => this.props.onSetLoadingMethod(previousMethod.id)}>
                      <Icons.LeftArrow height="12px" />
                      <span>Back</span>
                    </BackLink>
                    <FileUpload onFileUpload={this.props.onFileUpload} />
                  </div>
                ) : null}
                {loadingMethod.id === 'sample' ? (
                  <div className="gallery">
                    <ShapeFile className="shapefile-gallery">
                      {this.state.isShapefileListLoading ? (
                        <StyledSpinner>
                          <LoadingSpinner />
                        </StyledSpinner>
                      ) : (
                          <CountryShapefileSelect
                            adminList={this.state.adminList}
                            countryList={this.state.countryAndAdminList}
                            onAdminChange={this.handleAdminChange}
                            onCountryChange={this.handleCountryChange}
                            onShapefileSelected={this.handleShapefileChoice}
                            showAdmins={this.state.countrySelected}
                            submitReady={this.state.submitReady} />
                        )}
                    <hr />
                    <p>Here are a few examples of data visualization</p>
                    </ShapeFile>
                    <SampleMapGallery
                      sampleData={currentOption}
                      sampleMaps={sampleMaps}
                      onLoadSampleData={this.props.onLoadSampleData} />
                  </div>
                ) : null}
              </div>)
          }
        </div>
      </ThemeProvider>
    );
  }
};

const Tabs = ({ method, toggleMethod }) => (
  <ModalTab className="load-data-modal__tab">
    <div className="load-data-modal__tab__inner">
      {LOADING_METHODS.map(
        ({ id, label }) =>
          id !== 'upload' ? (
            <div
              className={classnames('load-data-modal__tab__item', {
                active: method && id === method
              })}
              key={id}
              onClick={() => toggleMethod(id)}
            >
              <div>{id=='sample'?'':label}</div>
            </div>
          ) : null
      )}
    </div>
    <TrySampleData onClick={() => toggleMethod(QUERY_TYPES.upload)} />
  </ModalTab>
);

const TrySampleData = ({ onClick }) => (
  <StyledTrySampleData className="try-sample-data">
    <div className="demo-map-title">

      <div className="demo-map-action" onClick={onClick}>
      <div className="demo-map-label">Load Your Own Data</div>
        <Icons.ArrowRight height="16px" />
      </div>
    </div>
  </StyledTrySampleData>
);

LoadDataModal.propTypes = propTypes;

const mapStateToProps = state => state;
const dispatchToProps = dispatch => ({ dispatch });

export default connect(
  mapStateToProps,
  dispatchToProps
)(LoadDataModal);
