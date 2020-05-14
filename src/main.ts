require('neuroglancer/ui/default_viewer.css');
require('./main.css');

import 'neuroglancer/sliceview/chunk_format_handlers';

import {setDefaultInputEventBindings} from 'neuroglancer/ui/default_input_event_bindings';
import {disableContextMenu, disableWheel} from 'neuroglancer/ui/disable_default_actions';
import {DisplayContext} from 'neuroglancer/display_context';
import {StatusMessage} from 'neuroglancer/status';
import {Viewer} from 'neuroglancer/viewer';

import {bindDefaultCopyHandler, bindDefaultPasteHandler} from 'neuroglancer/ui/default_clipboard_handling';
import {WhatsNewDialog} from 'neuroglancer/whats_new/whats_new';

import {setupVueApp} from './vueapp';
import {storeProxy} from './state';
import './config';

window.addEventListener('DOMContentLoaded', async () => {
  disableNGErrMsg();
  await loadConfig();
  setupVueApp();
  const viewer = setupViewer();
  storeProxy.initializeViewer(viewer);
  mergeTopBars();
  localStorage.setItem('neuroglancer-disableWhatsNew', '1');
  newUserExperience(viewer);
  storeProxy.loopUpdateLeaderboard();
});

export let config: Config;

async function loadConfig() {
  const configURL = 'src/config.json';
  config = await fetch(configURL).then(res => res.json());
}

function disableNGErrMsg() {
  const error = document.getElementById('nge-error');
  if (error) {
    error.style.display = 'none';
  }
}

function newUserExperience(viewer: Viewer) {
  const newUser = !localStorage.getItem('ng-newuser');
  if (newUser) {
    localStorage.setItem('ng-newuser', '1');
    const videoURL = `https://www.youtube.com/embed/KwMRgOFAsAU`
    const embedVid = `<iframe width='640' height='360' src="${
        videoURL}" frameborder="0" allow="autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    let description = `${(require('../src/NEW_USER.md')) || ''}<br>${embedVid}`;
    return new WhatsNewDialog(viewer, description, {center: true});
  }
  return;
}

function mergeTopBars() {
  const ngTopBar = document.getElementById('neuroglancerViewer')!.children[0];
  const topBarVueParent = document.getElementById('insertNGTopBar')!;
  topBarVueParent.appendChild(ngTopBar);
  const buttons = ngTopBar.querySelectorAll('div.neuroglancer-icon-button');
  for (const button of buttons) {
    const htmlButton = <HTMLElement>button;
    const text = htmlButton.title;
    const click = () => htmlButton.click();
    storeProxy.actionsMenuItems.push({text: text, click: click});
    button.remove();
  }
}

function setupViewer() {
  const viewer = (<any>window)['viewer'] = makeExtendViewer();
  setDefaultInputEventBindings(viewer.inputEventBindings);

  viewer.loadFromJsonUrl().then(() => {
    storeProxy.loadActiveDataset();
  });
  viewer.initializeSaver();

  bindDefaultCopyHandler(viewer);
  bindDefaultPasteHandler(viewer);

  return viewer;
}

function makeExtendViewer() {
  disableContextMenu();
  disableWheel();
  try {
    let display =
        new DisplayContext(document.getElementById('neuroglancer-container')!);
    return new ExtendViewer(display);
  } catch (error) {
    StatusMessage.showMessage(`Error: ${error.message}`);
    throw error;
  }
}

import {authTokenShared} from 'neuroglancer/authentication/frontend';
import Config from './config';

class ExtendViewer extends Viewer {
  constructor(public display: DisplayContext) {
    super(display, {
      showLayerDialog: false,
      showUIControls: true,
      showPanelBorders: true,
      defaultLayoutSpecification: 'xy-3d',
    });

    storeProxy.loadedViewer = true;
    authTokenShared!.changed.add(() => {
      storeProxy.fetchLoggedInUser();
    });
    storeProxy.fetchLoggedInUser();

    if (!this.jsonStateServer.value) {
      this.jsonStateServer.value = config.linkShortenerURL;
    }
  }

  promptJsonStateServer(message: string): void {
    let json_server_input = prompt(message, config.linkShortenerURL);
    if (json_server_input !== null) {
      this.jsonStateServer.value = json_server_input;
    } else {
      this.jsonStateServer.reset();
    }
  }
}
