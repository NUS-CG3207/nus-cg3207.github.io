import * as state from '@codemirror/state';
import * as view from '@codemirror/view';
import * as language from '@codemirror/language';
import * as commands from '@codemirror/commands';
import * as search from '@codemirror/search';
import * as autocomplete from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';

window.CM6 = {
  ...state,
  ...view,
  ...language,
  ...commands,
  ...search,
  ...autocomplete,
  tags
};
