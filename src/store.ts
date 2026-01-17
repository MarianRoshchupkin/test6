import {configureStore} from '@reduxjs/toolkit';
import {peopleUi} from "@/peopleUiSlice";
import {swapiApi} from "@/swapiApi";

export const store = configureStore({
  reducer: {
    [peopleUi.reducerPath]: peopleUi.reducer,
    [swapiApi.reducerPath]: swapiApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(swapiApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;