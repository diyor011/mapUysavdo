import UzbekistanMap from "./UzbekistanMap";

const data = [
    {
      name: "Qoraqalpogiston",
      polygon: [
        [100, 100],
        [200, 80],
        [300, 120],
        [400, 100],
        [400, 300],
        [300, 320],
        [200, 280],
        [100, 300]
      ]
    }
    // boshqa viloyatlar...
  ];
  
  // App.js ichida
  <UzbekistanMap data={data} />
  