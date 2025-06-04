import React, { FC } from 'react';

interface MapSettingProps {
  mapIndex: number | null;
  availableMaps: { index: number; title: string; }[];
  onMapChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled: boolean;
}

const MapSetting: FC<MapSettingProps> = ({ mapIndex, availableMaps, onMapChange, disabled }) => {
  return (
    <div className="row">
      <label htmlFor="sltMap">
        <i className="icon map"></i>
        <span data-trans>Map</span>
      </label>
      <select id="sltMap" value={mapIndex ?? ''} onChange={onMapChange} disabled={disabled}>
        {availableMaps.length === 0 ? (
          <option value="">Loading maps...</option>
        ) : (
          availableMaps.map((map) => (
            <option key={map.index} value={map.index.toString()}>
              {map.title}
            </option>
          ))
        )}
      </select>
    </div>
  );
};

export default MapSetting;
