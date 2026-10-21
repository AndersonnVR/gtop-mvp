# gtop-mvp 🚀

MVP de ERP para el Reto San José - Generación TOP 2026.

---

## 🛠️ Guía Rápida de GitHub para el Equipo

Esta sección es para que todos los miembros del equipo sepan cómo trabajar en este repositorio sin problemas.

### 1. Clonar el repositorio (Primera vez)
Para descargar el proyecto a tu computadora, abre tu terminal y ejecuta:
```bash
git clone https://github.com/tu-usuario/gtop-mvp.git
cd gtop-mvp
```

### 2. Crear una nueva rama (¡Importante!)
**Nunca trabajes directamente en la rama `main`.** Crea una rama nueva para cada tarea o funcionalidad que vayas a hacer:
```bash
git checkout -b nombre-de-tu-rama
```
*(Ejemplo: `git checkout -b base-de-datos` o `git checkout -b login-ui`)*

### 3. Guardar tus cambios (Commits)
Cuando hayas hecho modificaciones en los archivos y quieras guardarlas, ejecuta estos comandos en orden:

Primero, añade los archivos modificados:
```bash
git add .
```
Luego, crea un "commit" con un mensaje claro de lo que hiciste:
```bash
git commit -m "Añade el diseño de la página principal"
```

### 4. Subir tus cambios a GitHub (Push)
Para enviar tu trabajo al repositorio en internet:
```bash
git push origin nombre-de-tu-rama
```

### 5. Actualizar tu código local (Pull)
Antes de empezar a trabajar cada día, asegúrate de tener la última versión del código de tus compañeros:
```bash
git checkout main
git pull origin main
```
