// ...imports
import React, { useEffect, useState, useRef } from 'react';

const UzbekistanMap = () => {
  const mapRef = useRef(null);
  const [ymaps, setYmaps] = useState(null);
  const [map, setMap] = useState(null);
  const [viloyatlar, setViloyatlar] = useState([]);
  const [selectedViloyat, setSelectedViloyat] = useState(null);
  const [tumanlar, setTumanlar] = useState([]);
  const [selectedTuman, setSelectedTuman] = useState(null);
  const [mahallalar, setMahallalar] = useState([]);
  const [editableNarxlar, setEditableNarxlar] = useState({});
  const [activeMahallaId, setActiveMahallaId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const viloyatLayer = useRef(null);
  const tumanLayer = useRef(null);
  const mahallaLayer = useRef(null);

  useEffect(() => {
    if (window.ymaps) {
      setYmaps(window.ymaps);
    } else {
      const script = document.createElement('script');
      script.src = 'https://api-maps.yandex.ru/2.1/?apikey=YOUR_VALID_API_KEY_HERE&lang=uz_UZ';
      script.async = true;
      script.onload = () => window.ymaps.ready(() => setYmaps(window.ymaps));
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (ymaps && !map) {
      const newMap = new ymaps.Map(mapRef.current, {
        center: [41.3111, 69.2401],
        zoom: 6,
        controls: ['zoomControl', 'fullscreenControl'],
      });

      viloyatLayer.current = new ymaps.GeoObjectCollection();
      tumanLayer.current = new ymaps.GeoObjectCollection();
      mahallaLayer.current = new ymaps.GeoObjectCollection();

      newMap.geoObjects.add(viloyatLayer.current);
      newMap.geoObjects.add(tumanLayer.current);
      newMap.geoObjects.add(mahallaLayer.current);

      setMap(newMap);
      fetchViloyatlar();
    }
  }, [ymaps, map]);

  const fetchViloyatlar = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://admin.uysavdo.com/api/viloyatlar/');
      const data = await res.json();
      setViloyatlar(data);
    } catch {
      setError('Viloyatlarni olishda xatolik');
    }
    setLoading(false);
  };

  const fetchTumanlar = async (viloyatId) => {
    setLoading(true);
    try {
      const res = await fetch(`https://admin.uysavdo.com/api/tumanlar/${viloyatId}/`);
      const data = await res.json();
      setTumanlar(data.features || []);
    } catch {
      setError('Tumanlarni olishda xatolik');
    }
    setLoading(false);
  };

  const fetchMahallalar = async (tumanId) => {
    setLoading(true);
    try {
      const res = await fetch(`https://admin.uysavdo.com/api/mahallalar/${tumanId}/`);
      const data = await res.json();
      setMahallalar(data.features || []);

      const narxObj = {};
      for (const m of data.features) {
        try {
          const resNarx = await fetch(`https://admin.uysavdo.com/api/narx/${m.id}/`);
          const narxData = resNarx.ok ? await resNarx.json() : {};
          narxObj[m.id] = {
            narx_kvartira: narxData.narx_kvartira || '',
            narx_nejiloy: narxData.narx_nejiloy || '',
            narx_penthaus: narxData.narx_penthaus || '',
            narx_quruqyer: narxData.narx_quruqyer || '',
            narx_uchastka: narxData.narx_uchastka || '',
            narx_yangiqurilish: narxData.narx_yangiqurilish || '',
          };
        } catch {
          narxObj[m.id] = {
            narx_kvartira: '', narx_nejiloy: '', narx_penthaus: '',
            narx_quruqyer: '', narx_uchastka: '', narx_yangiqurilish: ''
          };
        }
      }
      setEditableNarxlar(narxObj);
    } catch {
      setError('Mahallalarni olishda xatolik');
    }
    setLoading(false);
  };

  const handleViloyatSelect = async (id) => {
    setSelectedViloyat(id);
    setSelectedTuman(null);
    setMahallalar([]);
    setEditableNarxlar({});
    mahallaLayer.current?.removeAll();
    await fetchTumanlar(id);
  };

  const handleTumanSelect = async (id) => {
    setSelectedTuman(id);
    setMahallalar([]);
    setEditableNarxlar({});
    viloyatLayer.current?.removeAll();
    await fetchMahallalar(id);
  };

  const parsePolygonGeometry = (str) => {
    if (!str) return [];
    try {
      const match = str.match(/\(\((.*?)\)\)/);
      if (!match || !match[1]) return [];
      return match[1].split(',').map(p => {
        const [lon, lat] = p.trim().split(' ').map(Number);
        return [lat, lon];
      });
    } catch {
      return [];
    }
};

  const renderViloyatlar = () => {
    if (!map || !viloyatLayer.current) return;
    viloyatLayer.current.removeAll();
    viloyatlar.forEach(v => {
      if (!v.polygon) return;
      const coords = parsePolygonGeometry(v.polygon);
      const polygon = new ymaps.Polygon([coords], { hintContent: v.name }, {
        fillColor: '#a1c4fd', fillOpacity: 0.5, strokeWidth: 2
      });
      polygon.events.add('click', () => handleViloyatSelect(v.id));
      viloyatLayer.current.add(polygon);
    });
  };

  const renderTumanlar = () => {
    if (!map || !tumanLayer.current) return;
    tumanLayer.current.removeAll();
    tumanlar.forEach(t => {
      if (!t.geometry) {
        console.warn("Tuman geometry yo'q:", t.properties?.name);
        return;
      }
      if (!t.geometry) return;
      const coords = parsePolygonGeometry(t.geometry);
      const polygon = new ymaps.Polygon([coords], { hintContent: t.properties?.name }, {
        fillColor: '#76b852', fillOpacity: 0.4, strokeWidth: 2
      });
      polygon.events.add('click', () => handleTumanSelect(t.id));
      tumanLayer.current.add(polygon);
    });
  };

  const handleNarxChange = (id, key, value) => {
    setEditableNarxlar(prev => ({
      ...prev,
      [id]: { ...prev[id], [key]: value }
    }));
  };

  const handleNarxSubmit = async (id) => {
    try {
      const res = await fetch(`https://admin.uysavdo.com/api/narx/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editableNarxlar[id])
      });
      if (!res.ok) alert("Xatolik yuz berdi");
      else alert("Muvaffaqiyatli saqlandi");
    } catch {
      alert("Tarmoqda xatolik");
    }
  };

  useEffect(() => renderViloyatlar(), [map, viloyatlar]);
  useEffect(() => renderTumanlar(), [map, tumanlar]);
  useEffect(() => {
    mahallaLayer.current?.removeAll();
    if (!map || !mahallalar.length) return;
    mahallalar.forEach(m => {
      if (!m.geometry) {
        console.warn("Mahalla geometry yo'q:", m.properties?.name);
        return;
      }
      const coords = parsePolygonGeometry(m.geometry);
      if (!coords.length) {
        console.warn("Mahalla noto‘g‘ri koordinata:", m.properties?.name);
        return;
      }
      const polygon = new ymaps.Polygon([coords], { hintContent: m.properties?.name }, {
        fillColor: '#fa709a',
        fillOpacity: 0.5,
        strokeWidth: 2
      });
      polygon.options.set('cursor', 'pointer');
      polygon.options.set('interactivityModel', 'default');
      polygon.events.add('click', () => {
        setActiveMahallaId(m.id);
        const bounds = polygon.geometry.getBounds();
        if (bounds) map.setBounds(bounds, { checkZoomRange: true });
      });
      mahallaLayer.current.add(polygon);
    });
  }, [map, mahallalar]);

  return (
    <div className="flex flex-col h-screen">
      <header className="text-2xl font-bold text-center py-4 bg-blue-100">O'zbekiston xaritasi</header>
      <div className="flex flex-1">
        <aside className="w-[250px] overflow-y-auto bg-white border-r">
          <div className="p-4 space-y-2">
            {selectedTuman && (
              <button
                onClick={() => {
                  setSelectedTuman(null);
                  setMahallalar([]);
                  setEditableNarxlar({});
                  viloyatLayer.current?.removeAll();
                  tumanLayer.current?.removeAll();
                  mahallaLayer.current?.removeAll();
                  renderViloyatlar();
                  map.setCenter([41.3111, 69.2401], 6);
                }}
                className="text-sm text-blue-600 hover:underline mb-2"
              >
                ⬅ Viloyatlarga qaytish
              </button>
            )}
            {selectedViloyat && !selectedTuman && (
              <button
                onClick={() => {
                  setSelectedViloyat(null);
                  setTumanlar([]);
                  setSelectedTuman(null);
                  setMahallalar([]);
                  setEditableNarxlar({});
                  viloyatLayer.current?.removeAll();
                  tumanLayer.current?.removeAll();
                  mahallaLayer.current?.removeAll();
                  renderViloyatlar();
                  map.setCenter([41.3111, 69.2401], 6);
                }}
                className="text-sm text-blue-600 hover:underline mb-2"
              >
                ⬅ Respublikaga qaytish
              </button>
            )}
            {viloyatlar.map(v => (
              <div key={v.id} onClick={() => handleViloyatSelect(v.id)}>{v.name}</div>
            ))}
            {selectedViloyat && tumanlar.map(t => (
              <div key={t.id} onClick={() => handleTumanSelect(t.id)} className="ml-4">{t.properties?.name}</div>
            ))}
          </div>
        </aside>
        <main className="flex-1 w-[80%]">
          <div ref={mapRef} className="w-full h-full" />
          {activeMahallaId && (
            <aside className="absolute right-0 top-0 w-[400px] h-full bg-white shadow-lg p-4 overflow-y-auto">
              {(() => {
                const m = mahallalar.find(x => x.id === activeMahallaId);
                if (!m) return null;
                return (
                  <div key={m.id}>
                    <button
                      onClick={() => setActiveMahallaId(null)}
                      className="text-sm text-blue-600 hover:underline mb-2"
                    >
                      ⬅ Ortga
                    </button>
                    <h2 className="text-xl font-bold mb-4">{m.properties?.name}</h2>
                    {Object.entries(editableNarxlar[m.id] || {}).map(([key, value]) => (
                      <div key={key} className="mb-2">
                        <label className="block text-sm font-medium mb-1">{key.replace('narx_', '').replace(/_/g, ' ')}</label>
                        <input
                          type="number"
                          className="w-full border px-2 py-1 rounded"
                          value={value}
                          onChange={e => handleNarxChange(m.id, key, e.target.value)}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => handleNarxSubmit(m.id)}
                      className="mt-2 bg-blue-600 text-white px-4 py-1 rounded"
                    >
                      Saqlash
                    </button>
                  </div>
                );
              })()}
            </aside>
          )}
        </main>
      </div>
    </div>
  );
};

export default UzbekistanMap;
