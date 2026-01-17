export type TFilm = {
  title: string;
}

export type TPerson = {
  name: string;
  height: string;
  mass: string;
  gender: string;
  films: string[];
  favorite?: boolean
}

export type TSwapiPerson = Omit<TPerson, "films"> & { films: string[] }