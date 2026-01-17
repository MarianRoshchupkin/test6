import {createSlice, PayloadAction} from '@reduxjs/toolkit';

type TPeopleUiState = {
  inputValue: string;
  search: string;
  favorites: string[];
}

const initialState: TPeopleUiState = {
  inputValue: '',
  search: '',
  favorites: []
}

export const peopleUi = createSlice({
  name: 'peopleUi',
  initialState,
  reducers: {
    setInputValue(state, action: PayloadAction<string>) {
      state.inputValue = action.payload;
    },
    commitSearch(state) {
      state.search = state.inputValue;
    },
    toggleFavoriteNames(state, action: PayloadAction<string>) {
      const name = action.payload;
      const idx = state.favorites.indexOf(name);

      if (idx === -1) {
        state.favorites.push(name);
      } else {
        state.favorites.splice(idx, 1);
      }
    }
  }
});

export const { setInputValue, commitSearch, toggleFavoriteNames } = peopleUi.actions;