import {commitSearch, setInputValue, toggleFavoriteNames} from "@/peopleUiSlice";
import {ChangeEvent, ReactElement, useCallback, useEffect, useRef} from "react";
import {useSearchPeopleQuery, useToggleFavoriteMutation} from "@/swapiApi";
import {useDispatch, useSelector} from "react-redux";
import {List, RowComponentProps} from "react-window";
import {RootState} from "@/store";
import {TPerson} from "@/types";

type TProps<T> = {
  items: T[];
  itemHeight: number;
  height?: number;
  width?: number;
  overscanCount?: number;
  renderItem: (item: T, index: number) => ReactElement;
  autoSize?: boolean;
}

type TRowProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactElement;
}

const Row = <T,>({ items, index, style, renderItem }: RowComponentProps<TRowProps<T>>) => {
  const item = items[index];

  return (
    <div style={style}>
      {renderItem(item, index)}
    </div>
  );
}

const VirtualizedList = <T,>({
  items,
  itemHeight,
  height = 400,
  width = 360,
  overscanCount = 8,
  renderItem,
  autoSize = false
}: TProps<T>) => {
  const rowProps: TRowProps<T> = ({ items, renderItem });

  return (
    <div style={{ height, width, minHeight: height }}>
      <List<TRowProps<T>>
        rowComponent={Row}
        rowCount={items.length}
        rowHeight={itemHeight}
        rowProps={rowProps}
        overscanCount={overscanCount}
        style={ autoSize ? undefined : { height, width }}
      />
    </div>
  );
}

const useDebounceCallback = (callback: () => void, delay: number) => {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debounced = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      callbackRef.current();
    }, delay);
  }, [delay]);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return debounced;
}

export const App = () => {
  const inputValue = useSelector((state: RootState) => state.peopleUi.inputValue);
  const search = useSelector((state: RootState) => state.peopleUi.search);
  const { data: people = [], isFetching, isError, error } = useSearchPeopleQuery({ search });
  console.log(people);
  const [toggleFavorite] = useToggleFavoriteMutation();
  const dispatch = useDispatch();

  const debouncedFetch = useDebounceCallback(() => dispatch(commitSearch()), 500);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;

    dispatch(setInputValue(query));
    debouncedFetch();
  }

  const handleClick = (personName: string) => {
    dispatch(toggleFavoriteNames(personName));

    toggleFavorite({ search, personName })
      .unwrap()
      .catch(() => dispatch(toggleFavoriteNames(personName)));
  }

  const renderPerson = useCallback(
    (person: TPerson) => (
      <li key={`${person.name}_${person.height}`}>
        <div>Имя: {person.name}</div>
        <div>Рост: {person.height}</div>
        <div>Вес: {person.mass}</div>
        <div>Пол: {person.gender}</div>
        <div onClick={() => handleClick(person.name)}>
          {person.favorite ? "В Избранном*" : "В Избранном*"}
        </div>
        <ul>
          {person.films.map((film) =>
            <li key={`${person.name}_${film}`}>
              {film}
            </li>
          )}
        </ul>
      </li>
    ),
    [handleClick]
  );

  return (
    <>
      <input value={inputValue} onChange={handleChange} />
      {isFetching && <div>Загрузка...</div>}
      {isError && <div>{error instanceof Error ? error.message : String(error)}</div>}
      <VirtualizedList
        items={people}
        itemHeight={400}
        renderItem={renderPerson}
      />
    </>
  );
}