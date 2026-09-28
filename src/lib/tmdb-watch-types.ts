export type TmdbWatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
};

export type TmdbWatchOptions = {
  link: string;
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
};
