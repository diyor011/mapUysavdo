import React, { useEffect, useState, useRef, Suspense } from 'react';
import { IoMdArrowRoundBack } from "react-icons/io";

// Loading komponentini yaratamiz
const LoadingSpinner = () => (
  <div className="flex h-full w-full items-center justify-center">
    <span className="loading loading-spinner loading-xl"></span>
  </div>
);

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

  useEffect(() => {
    if (!map) return;

    const handleResize = () => map.container.fitToViewport();
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [map]);

  useEffect(() => {
    if (map) {
      setTimeout(() => map.container.fitToViewport(), 100);
    }
  }, [activeMahallaId]);
  

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
      const features = data.features || [];
      
      // Toshkent viloyati bo'lsa, Chirchiq tumani uchun maxsus tekshirish
      if (viloyatId === 14 || viloyatId === 11) { // Toshkent yoki Navoiy viloyati ID raqami
        console.log(`Maxsus viloyat (ID: ${viloyatId}) tumanlari yuklandi: ${features.length}`);
        
        // Tumanlar ma'lumotlarini ekranga chiqaramiz
        features.forEach(t => {
          if (t.properties?.name && 
              (t.properties.name.includes('Chirchiq') || 
               t.properties.name.includes('Navoiy'))) {
            console.log(`Maxsus tuman topildi: ${t.properties.name}, ID: ${t.id}`);
            console.log(`Geometry: ${t.geometry?.substring(0, 100)}...`);
          }
        });
      }
      
      setTumanlar(features);
    } catch (error) {
      console.error("Tumanlarni yuklashda xatolik:", error);
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
    setActiveMahallaId(null);
    
    // Barcha layerlarni tozalash
    mahallaLayer.current?.removeAll();
    tumanLayer.current?.removeAll();
    viloyatLayer.current?.removeAll();

    const viloyat = viloyatlar.find(v => v.id === id);
    if (viloyat && viloyat.polygon && map && viloyatLayer.current) {
      const coords = parsePolygonGeometry(viloyat.polygon);

      const polygon = new ymaps.Polygon([coords], { hintContent: viloyat.name }, {
        fillColor: '#a1c4fd',
        fillOpacity: 0.5,
        strokeWidth: 2
      });

      viloyatLayer.current.add(polygon);

      const bounds = polygon.geometry.getBounds();
      if (bounds) {
        map.setBounds(bounds, {
          checkZoomRange: true,
          duration: 1000,
        });
      }
    }

    // Eng muhimi - tumanlarni yuklash va chizish
    await fetchTumanlar(id);
  };

  // Tuman dan viloyatga qaytish funksiyasi
  const handleReturnToViloyat = () => {
    setSelectedTuman(null);
    setMahallalar([]);
    setEditableNarxlar({});
    setActiveMahallaId(null);
    
    // Barcha layerlarni tozalash
    mahallaLayer.current?.removeAll();
    tumanLayer.current?.removeAll();
    viloyatLayer.current?.removeAll();
    
    // Viloyatni qayta chizish
    const viloyat = viloyatlar.find(v => v.id === selectedViloyat);
    if (viloyat && viloyat.polygon && map && viloyatLayer.current) {
      const coords = parsePolygonGeometry(viloyat.polygon);
      
      const polygon = new ymaps.Polygon([coords], { hintContent: viloyat.name }, {
        fillColor: '#a1c4fd',
        fillOpacity: 0.5,
        strokeWidth: 2
      });
      
      viloyatLayer.current.add(polygon);
      
      const bounds = polygon.geometry.getBounds();
      if (bounds) {
        map.setBounds(bounds, {
          checkZoomRange: true,
          duration: 1000
        });
      }
    }

    // Tumanlarni qayta yuklash va chizish
    fetchTumanlar(selectedViloyat);
  };

  const handleTumanSelect = async (id) => {
    setSelectedTuman(id);
    setActiveMahallaId(null);
    setMahallalar([]);
    setEditableNarxlar({});
  
    // Barcha layerlarni tozalash
    viloyatLayer.current?.removeAll();
    tumanLayer.current?.removeAll();
    mahallaLayer.current?.removeAll();
  
    // Tuman ma'lumotlarini olish
    const tuman = tumanlar.find(t => t.id === id);
    if (tuman && tuman.geometry && map && tumanLayer.current) {
      // Debug uchun
      console.log(`Tuman ID ${id} geometriyasi:`, tuman.geometry);
      
      const coords = parsePolygonGeometry(tuman.geometry);
      // Debug uchun
      console.log(`Tuman ID ${id} koordinatalari:`, coords);
      
      if (!coords.length) {
        console.error(`Tuman ID ${id} uchun koordinatalar yaratilmadi`);
        return;
      }
  
      // Polygonni yaratamiz
      const polygon = new ymaps.Polygon([coords], { hintContent: tuman.properties?.name }, {
        fillColor: '#76b852',
        fillOpacity: 0.4,
        strokeWidth: 2
      });
  
      // Avval xaritaga qo'shamiz
      tumanLayer.current.add(polygon);
  
      // Keyin zoom qilamiz - kechiktirib bajarish orqali
      setTimeout(() => {
        const bounds = polygon.geometry.getBounds();
        if (bounds) {
          map.setBounds(bounds, {
            checkZoomRange: true,
            duration: 1000
          });
        }
      }, 100);
    }
  
    // Mahallalarni olish
    await fetchMahallalar(id);
  };

  // Respublikaga to'liq qaytish funksiyasi
  const handleReturnToRepublic = () => {
    setSelectedViloyat(null);
    setTumanlar([]);
    setSelectedTuman(null);
    setMahallalar([]);
    setEditableNarxlar({});
    setActiveMahallaId(null);
    
    // Barcha layerlarni tozalash
    viloyatLayer.current?.removeAll();
    tumanLayer.current?.removeAll();
    mahallaLayer.current?.removeAll();
    
    // Respublika holatida barcha viloyatlarni chizish
    renderViloyatlar();
    map.setCenter([41.3111, 69.2401], 6);
  };

  const parsePolygonGeometry = (str) => {
    if (!str) return [];
    try {
      // Multipolygon va polygon formatlarini qo'llab-quvvatlash
      // MULTIPOLYGON formatida bo'lishi mumkin
      if (str.startsWith('MULTIPOLYGON')) {
        const multiMatch = str.match(/\(\(\((.*?)\)\)\)/g);
        if (multiMatch && multiMatch.length) {
          // Birinchi polygonni qaytaramiz (asosiy hududni)
          const firstPolygon = multiMatch[0].match(/\(\(\((.*?)\)\)\)/);
          if (firstPolygon && firstPolygon[1]) {
            return firstPolygon[1].split(',').map(p => {
              const [lon, lat] = p.trim().split(' ').map(Number);
              return [lat, lon];
            });
          }
        }
      }
      
      // Oddiy POLYGON formatida
      const match = str.match(/\(\((.*?)\)\)/);
      if (!match || !match[1]) return [];
      return match[1].split(',').map(p => {
        const [lon, lat] = p.trim().split(' ').map(Number);
        return [lat, lon];
      });
    } catch (error) {
      console.error("Polygon parsing error:", error);
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
        fillColor: '#a1c4fd', 
        fillOpacity: 0.5, 
        strokeWidth: 2
      });
      polygon.events.add('click', () => handleViloyatSelect(v.id));
      viloyatLayer.current.add(polygon);
    });
  };

  const renderTumanlar = () => {
    if (!map || !tumanLayer.current || !tumanlar.length) return;
    
    // Polygonlarni tozalash
    tumanLayer.current.removeAll();
    
    // Tumanlar sonini ekranga chiqaramiz
    console.log(`Chizilishi kerak bo'lgan tumanlar soni: ${tumanlar.length}`);
    
    let drawnPolygons = 0;
    
    tumanlar.forEach(t => {
      if (!t.geometry) {
        console.log(`Tuman ID ${t.id} uchun geometriya mavjud emas`);
        return;
      }
      
      // Toshkent va Navoiy viloyatlaridagi tumanlar uchun maxsus tekshirish
      const isSpecialTuman = t.properties?.name && 
        (t.properties.name.includes('Chirchiq') || 
         t.properties.name.includes('Navoiy'));
      
      // Polygon koordinatalarini aniqlash
      let coords = parsePolygonGeometry(t.geometry);
      
      // Agar koordinatalar bo'sh bo'lsa va maxsus tuman bo'lsa
      if (!coords.length && isSpecialTuman) {
        console.log(`Maxsus tuman ${t.properties?.name} uchun qayta urinish`);
        
        // MultiPolygon formatidagi stringni qayta tahlil qilish
        try {
          if (t.geometry.includes('MULTIPOLYGON')) {
            // MULTIPOLYGON formatini to'g'ridan-to'g'ri qayta ishlash
            const regex = /\(\(([\d\s\.,]+)\)\)/g;
            const matches = [...t.geometry.matchAll(regex)];
            
            if (matches.length > 0) {
              // Birinchi topilgan poligon koordinatalarini olish
              const coordStr = matches[0][1];
              coords = coordStr.split(',').map(p => {
                const [lon, lat] = p.trim().split(' ').map(Number);
                return [lat, lon];
              });
              console.log(`Maxsus tuman uchun koordinatalar topildi: ${coords.length}`);
            }
          }
        } catch (err) {
          console.error(`Maxsus tuman koordinatalarini ishlashda xatolik:`, err);
        }
      }
      
      if (!coords.length) {
        console.log(`Tuman ID ${t.id}, ${t.properties?.name} uchun koordinatalar topilmadi`);
        return;
      }
      
      drawnPolygons++;
      
      const polygon = new ymaps.Polygon([coords], { 
        hintContent: t.properties?.name 
      }, {
        fillColor: '#76b852', 
        fillOpacity: 0.4, 
        strokeWidth: 2,
        // Interaktivlikni oshiramiz
        strokeColor: '#4b7e35',
        interactivityModel: 'default#geoObject',
        cursor: 'pointer'
      });
      
      // Click event qo'shamiz
      polygon.events.add('click', () => handleTumanSelect(t.id));
      
      // Mouse over va mouse out eventlari
      polygon.events.add('mouseenter', () => {
        polygon.options.set('fillOpacity', 0.6);
        polygon.options.set('strokeWidth', 3);
      });
      
      polygon.events.add('mouseleave', () => {
        polygon.options.set('fillOpacity', 0.4);
        polygon.options.set('strokeWidth', 2);
      });
      
      // Layerga qo'shamiz
      tumanLayer.current.add(polygon);
    });
    
    // Statistika
    console.log(`Chizilgan tumanlar soni: ${drawnPolygons}/${tumanlar.length}`);
    
    // Tumanlar layerini xaritaga qo'shamiz (kerak bo'lsa)
    if (!map.geoObjects.get(tumanLayer.current)) {
      map.geoObjects.add(tumanLayer.current);
    }
  };

  const handleNarxChange = (id, key, value) => {
    setEditableNarxlar(prev => ({
      ...prev,
      [id]: { ...prev[id], [key]: value }
    }));
  };

  const handleNarxSubmit = async (id) => {
    setLoading(true);
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
    setLoading(false);
  };

  // Viloyatlar render uchun effect
  useEffect(() => {
    if (!selectedViloyat) {
      renderViloyatlar();
    }
  }, [map, viloyatlar, selectedViloyat]);
  
  // Tumanlar render uchun effect
  useEffect(() => {
    // Faqat viloyat tanlanganda va tuman tanlanmaganda tumanlarni chizish
    if (selectedViloyat && !selectedTuman && tumanlar.length > 0) {
      console.log("Tumanlarni chizish boshlanmoqda...");
      renderTumanlar();
    }
  }, [map, tumanlar, selectedViloyat, selectedTuman]);

  // Mahallalar render uchun effect
  useEffect(() => {
    mahallaLayer.current?.removeAll();
    if (!map || !mahallalar.length || !selectedTuman) return;

    mahallalar.forEach(m => {
      if (!m.geometry) return;

      const coords = parsePolygonGeometry(m.geometry);
      if (!coords.length) return;

      const polygon = new ymaps.Polygon([coords], { hintContent: m.properties?.name }, {
        fillColor: '#fa709a',
        fillOpacity: 0.5,
        strokeWidth: 2,
      });

      polygon.options.set('cursor', 'pointer');
      polygon.options.set('interactivityModel', 'default');

      polygon.events.add('click', () => {
        setActiveMahallaId(m.id);

        // Mahalla layerni ustiga chiqarish
        if (!map.geoObjects.get(mahallaLayer.current)) {
          map.geoObjects.add(mahallaLayer.current);
        }

        // Zoom qilish
        const bounds = polygon.geometry.getBounds();
        if (bounds) {
          map.setBounds(bounds, {
            checkZoomRange: true,
            duration: 1000,
          });
        }
      });

      mahallaLayer.current.add(polygon);
    });
    
    // Mahallalar layerini xaritaga qo'shamiz (kerak bo'lsa)
    if (!map.geoObjects.get(mahallaLayer.current)) {
      map.geoObjects.add(mahallaLayer.current);
    }
  }, [map, mahallalar, selectedTuman]);

  return (
    <div className="flex flex-col h-screen">
      <header className="text-2xl font-bold text-center py-4 bg-blue-100">O'zbekiston xaritasi</header>
      <main className="flex flex-1 gap-4 overflow-hidden relative">
        {/* Loading spinner uchun overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-70 z-50 flex items-center justify-center">
            <span className="loading loading-spinner loading-xl"></span>
          </div>
        )}
        
        <aside className="w-[20%] h-full overflow-y-auto bg-white">
          <div className="p-4 space-y-2">
            {selectedTuman && (
              <button
                onClick={handleReturnToViloyat}
                className="btn btn-soft btn-accent hover:text-white"
                disabled={loading}
              >
                <IoMdArrowRoundBack /> Viloyatlarga qaytish
              </button>
            )}
            {selectedViloyat && !selectedTuman && (
              <button
                onClick={handleReturnToRepublic}
                className="btn btn-soft btn-accent hover:text-white"
                disabled={loading}
              >
                <IoMdArrowRoundBack /> Respublikaga qaytish
              </button>
            )}
            {viloyatlar.map(v => {
              const isActive = selectedViloyat === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => !loading && handleViloyatSelect(v.id)}
                  className={`cursor-pointer px-2 py-1 rounded ${
                    isActive
                      ? 'bg-gradient-to-r from-[#0AA3A1] to-[#B4C29E] text-white'
                      : loading ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100'
                  }`}
                >
                  {v.name}
                </div>
              );
            })}

            {selectedViloyat && tumanlar.map(t => (
              <div 
                key={t.id} 
                onClick={() => !loading && handleTumanSelect(t.id)} 
                className={`ml-4 cursor-pointer px-2 py-1 rounded ${
                  selectedTuman === t.id
                    ? 'bg-gradient-to-r from-[#76b852] to-[#8DC26F] text-white'
                    : loading ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100'
                }`}
              >
                {t.properties?.name}
              </div>
            ))}
          </div>
        </aside>

        <section className="flex-1 relative rounded-2xl p-4">
          <Suspense fallback={<LoadingSpinner />}>
            <div ref={mapRef} className="flex-1 min-h-[600px] h-full w-full rounded-2xl overflow-hidden" />
          </Suspense>
          
          {activeMahallaId && (
            <aside className="absolute right-0 top-0 w-[400px] h-full bg-white shadow-lg p-4 overflow-y-auto z-10">
              {(() => {
                const m = mahallalar.find(x => x.id === activeMahallaId);
                if (!m) return null;
                return (
                  <div key={m.id}>
                    <button 
                      className="btn btn-soft btn-accent hover:text-white"
                      onClick={() => setActiveMahallaId(null)}
                      disabled={loading}
                    >
                      ortga qaytish
                    </button>
                    <h2 className="text-xl font-bold mb-4">{m.properties?.name}</h2>
                    {Object.entries(editableNarxlar[m.id] || {}).map(([key, value]) => (
                      <div key={key} className="mb-2">
                        <label className="block text-sm font-semibold mb-1">
                          {key.replace('narx_', '').replace(/_/g, ' ')}
                        </label>
                        <input 
                          type="number"
                          value={value}
                          className="input input-accent"
                          onChange={e => handleNarxChange(m.id, key, e.target.value)}
                          disabled={loading}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => handleNarxSubmit(m.id)}
                      className="btn btn-soft btn-accent hover:text-white"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="loading loading-spinner loading-sm"></span>
                      ) : "Saqlash"}
                    </button>
                  </div>
                );
              })()}
            </aside>
          )}
        </section>
      </main>
    </div>
  );
};

export default UzbekistanMap;