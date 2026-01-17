import {createApi, fetchBaseQuery, FetchBaseQueryError} from '@reduxjs/toolkit/query/react';
import {TFilm, TPerson, TSwapiPerson} from '@/types';

type TSearchPeopleArg = {
  search: string;
}

export const swapiApi = createApi({
  reducerPath: 'swapiApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://swapi.py4e.com'
  }),
  tagTypes: ['Person'],
  endpoints: (builder) => ({
    searchPeople: builder.query<TPerson[], TSearchPeopleArg>({
      async queryFn(arg, _api, _extraOptions, baseQuery) {
        const { search } = arg;

        if (!search.trim()) {
          return { data: [] as TPerson[] };
        }

        const peopleResult = await baseQuery({
          url: `/api/people/?search=${encodeURIComponent(search.trim())}&page=1`
        });

        if (peopleResult.error) {
          return { error: peopleResult.error as FetchBaseQueryError };
        }

        const payload = peopleResult.data as { results?: TSwapiPerson[] };
        const people = payload?.results ?? [];

        try {
          const peopleWithFilms = await Promise.all(
            people.map(async (person) => {
              const films = await Promise.all(
                person.films.map(async (url) => {
                  const path = new URL(url).pathname;
                  const result = await baseQuery({ url: path });

                  if (result.error) {
                    throw result.error;
                  }

                  const data = result.data as TFilm;

                  return data.title;
                })
              );

              return { ...person, films };
            })
          );

          return { data: peopleWithFilms }
        } catch(err) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: err instanceof Error ? err.message : String(err)
            } as FetchBaseQueryError
          }
        }
      }
    }),
    toggleFavorite: builder.mutation<void, { search: string, personName: string }>({
      query: ({ personName }) => ({
        method: 'POST',
        url: '/api/favorites',
        body: { name: personName }
      }),
      async onQueryStarted(
        { search, personName },
        { dispatch, queryFulfilled }
      ) {
        const patchResult = dispatch(
          swapiApi.util.updateQueryData(
            'searchPeople',
            { search },
            (draft) => {
              const person = draft.find((p) => p.name === personName);

              if (person) {
                person.favorite = !person.favorite;
              }
            }
          )
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      }
    }),
  })
});

export const { useSearchPeopleQuery, useToggleFavoriteMutation } = swapiApi;