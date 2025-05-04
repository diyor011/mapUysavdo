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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?apikey=41bc0f32-8a03-4bb9-9a0d-a8ffbe71b0b9&lang=uz_UZ';
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => {
        setYmaps(window.ymaps);
      });
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (ymaps && !map) {
      const newMap = new ymaps.Map(mapRef.current, {
        center: [41.3111, 69.2401],
        zoom: 6,
        controls: ['zoomControl', 'fullscreenControl']
      });
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      setError('Mahallalarni olishda xatolik');
    }
    setLoading(false);
  };

  const handleViloyatSelect = async (id) => {
    const selected = viloyatlar.find(v => v.id === id);
    if (selected?.polygon) {
      const coords = parsePolygonGeometry(selected.polygon);
      if (coords.length && map) {
        map.setCenter(coords[0], 7);
      }
    }
    setSelectedViloyat(id);
    setSelectedTuman(null);
    setTumanlar([]);
    setMahallalar([]);
    await fetchTumanlar(id);
  };

  const handleTumanSelect = async (id) => {
    const selected = tumanlar.find(t => t.id === id);
    if (selected?.geometry) {
      const coords = parsePolygonGeometry(selected.geometry);
      if (coords.length && map) {
        map.setCenter(coords[0], 9);
      }
    }
    setSelectedTuman(id);
    setMahallalar([]);
    await fetchMahallalar(id);
  };

  const parsePolygonGeometry = (str) => {
    if (!str) return [];
    try {
      let coords = str.split('POLYGON ')[1];
      coords = coords.replace(/[()]/g, '').trim();
      return coords.split(', ').map(p => {
        const [lon, lat] = p.split(' ').map(Number);
        return [lat, lon];
      });
    } catch (e) {
      console.error('Parsing error', e);
      return [];
    }
  };

  const renderViloyatlar = () => {
    if (!map || !viloyatlar.length) return;
    map.geoObjects.removeAll();
    viloyatlar.forEach(v => {
      if (!v.polygon) return;
      const coords = parsePolygonGeometry(v.polygon);
      const polygon = new ymaps.Polygon([coords], { hintContent: v.name }, {
        fillColor: '#a1c4fd',
        fillOpacity: 0.5,
        strokeWidth: 2
      });
      polygon.events.add('click', () => handleViloyatSelect(v.id));
      map.geoObjects.add(polygon);
    });
  };

  useEffect(() => {
    renderViloyatlar();
  }, [map, viloyatlar]);

  useEffect(() => {
    if (!map || !tumanlar.length) return;
    map.geoObjects.removeAll();
    tumanlar.forEach(t => {
      if (!t.geometry) return;
      const coords = parsePolygonGeometry(t.geometry);
      const polygon = new ymaps.Polygon([coords], { hintContent: t.properties?.name }, {
        fillColor: '#76b852',
        fillOpacity: 0.4,
        strokeWidth: 2
      });
      polygon.events.add('click', () => handleTumanSelect(t.id));
      map.geoObjects.add(polygon);
    });
  }, [map, tumanlar]);

  useEffect(() => {
    if (!map || !mahallalar.length) return;
    map.geoObjects.removeAll();
    mahallalar.forEach(m => {
      if (!m.geometry) return;
      const coords = parsePolygonGeometry(m.geometry);
      const polygon = new ymaps.Polygon([coords], { hintContent: m.properties?.name }, {
        fillColor: '#fa709a',
        fillOpacity: 0.5,
        strokeWidth: 2
      });
      map.geoObjects.add(polygon);
    });

    if (mahallalar.length && mahallalar[0].geometry) {
      const first = parsePolygonGeometry(mahallalar[0].geometry);
      if (first.length) map.setCenter(first[0], 12);
    }
  }, [map, mahallalar]);

  return (
    <div className="flex flex-col h-screen">
      <header className="text-2xl font-bold text-center py-4 bg-blue-100">O'zbekiston xaritasi</header>
      <div className="flex flex-1 justify-between">
        <aside className="w-2/5 max-h-[680px] overflow-y-auto bg-white border-r shadow-sm">
          <div className="p-4 h-full flex flex-col space-y-6">
            {error && <div className="text-red-500">{error}</div>}

            {/* MAHALLALAR */}
            {selectedTuman && (
              <div>
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold mb-2 text-pink-700">Mahallalar</h3>
                  <button
                    onClick={() => {
                      setSelectedTuman(null);
                      setMahallalar([]);
                      if (map) map.setCenter([41.3111, 69.2401], 6);
                      renderViloyatlar();
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    ⬅ Ortga
                  </button>
                </div>
                {loading ? <p>Yuklanmoqda...</p> : (
                  <ul className="space-y-2">
                    {mahallalar.map(m => (
                      <li
                        key={m.id}
                        className="p-2 rounded hover:bg-pink-50 transition-all duration-200"
                      >
                        {m.properties?.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* TUMANLAR */}
            {selectedViloyat && (
              <div>
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold mb-2 text-green-700">Tumanlar</h3>
                  <button
                    onClick={() => {
                      setSelectedViloyat(null);
                      setTumanlar([]);
                      setSelectedTuman(null);
                      setMahallalar([]);
                      if (map) map.setCenter([41.3111, 69.2401], 6);
                      renderViloyatlar();
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    ⬅ Ortga
                  </button>
                </div>
                {loading ? <p>Yuklanmoqda...</p> : (
              <ul className="space-y-2">
              {tumanlar.map(t => (
                <li
                  key={t.id}
                  onClick={() => handleTumanSelect(t.id)}
                  className={`p-2 rounded cursor-pointer transition-all duration-200 
                    ${selectedTuman === t.id
                      ? 'bg-gradient-to-r from-[#0AA3A1] to-[#B4C29E] text-white'
                      : 'hover:bg-green-50'
                    }`}
                >
                  {t.properties?.name}
                </li>
              ))}
            </ul>
            
                )}
              </div>
            )}

            {/* VILOYATLAR */}
            {!selectedViloyat && (
              <div>
                <h3 className="text-xl font-semibold mb-2 text-blue-700">Viloyatlar</h3>
                {loading ? <p>Yuklanmoqda...</p> : (
                  <ul className="space-y-2">
                    {viloyatlar.map(v => (
                      <li
                        key={v.id}
                        onClick={() => handleViloyatSelect(v.id)}
                        className={`p-2 rounded cursor-pointer transition-all duration-200 hover:bg-blue-50`}
                      >
                        {v.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>

        <main className="w-3/2 h-full">
          <div ref={mapRef} className="w-full h-full" />
        </main>
      </div>
    </div>
  );
};

export default UzbekistanMap;
