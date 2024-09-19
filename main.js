const { Plugin, PluginSettingTab, Setting, TextComponent } = require('obsidian');

module.exports = class SymbolReplacementPlugin extends Plugin {
  async onload() {
    // Cargar configuraciones del usuario (si existen)
    this.settings = await this.loadData();

    // Registrar un evento para cuando se detecte un cambio en el editor
    this.registerEvent(this.app.workspace.on('editor-change', (editor) => {
      this.registerKeydownEvent(editor);
    }));

    // Añadir opciones de configuración
    this.addSettingTab(new SymbolReplacementSettingTab(this.app, this));
  }

  registerKeydownEvent(editor) {
    const onKeyDown = (event) => {
      if (event.key === ' ') {
        this.replaceSymbols(editor);
      } else if (event.ctrlKey && event.key === 'z') {
        this.undoReplacement(editor);
      }
    };

    editor.containerEl.addEventListener('keydown', onKeyDown);

    // Limpiar el evento al salir del editor
    editor.containerEl.addEventListener('blur', () => {
      editor.containerEl.removeEventListener('keydown', onKeyDown);
    });
  }

  replaceSymbols(editor) {
    // Obtener la posición del cursor
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line); // Obtener la línea actual del cursor

    // Obtener el texto antes del cursor
    const textBeforeCursor = line.slice(0, cursor.ch);

    // Ordenar los patrones por longitud, de mayor a menor
    const sortedPatterns = Object.keys(this.settings.replacements).sort((a, b) => b.length - a.length);

    // Verificar si hay coincidencias en el texto antes del cursor
    for (const pattern of sortedPatterns) {
      if (textBeforeCursor.endsWith(pattern)) {
        const replacement = this.settings.replacements[pattern];
        this.originalText = line; // Almacenar el texto original antes del reemplazo
        const newLine = line.replace(new RegExp(pattern + '$', 'g'), replacement);
        editor.setLine(cursor.line, newLine);
        this.replacementMade = true; // Marcar que se realizó un reemplazo
        break; // Salir después de hacer el reemplazo
      }
    }
  }

  undoReplacement(editor) {
    if (this.replacementMade && this.originalText) {
      const cursor = editor.getCursor();
      editor.setLine(cursor.line, this.originalText+' '); // Restablecer el texto original
      this.replacementMade = false; // Resetear la marca de reemplazo
      this.originalText = null; // Limpiar el texto original
    //   new Notice("Reemplazo deshecho."); // Mensaje de notificación
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {
    // Aquí puedes agregar lógica para cuando el plugin se desinstale (opcional)
  }
}

// Clase para el panel de configuración
class SymbolReplacementSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: 'Configuración de reemplazos de símbolos' });

    for (let [pattern, replacement] of Object.entries(this.plugin.settings.replacements)) {
      new Setting(containerEl)
        .setName(`Reemplazo: ${pattern}`)
        .setDesc(`Reemplazar con: ${replacement}`)
        .addText(text => 
          text.setValue(pattern)
            .onChange(async (value) => {
              if (value.trim() === "") {
                new Notice("El patrón no puede estar vacío.");
                return;
              }
              if (this.plugin.settings.replacements[value] && value !== pattern) {
                new Notice("Este patrón ya existe.");
                return;
              }

              const newReplacement = replacement;
              delete this.plugin.settings.replacements[pattern];
              this.plugin.settings.replacements[value] = newReplacement;
              await this.plugin.saveSettings();
              this.display();
            }))
        .addExtraButton(btn => btn
          .setIcon('trash')
          .setTooltip('Eliminar')
          .onClick(async () => {
            delete this.plugin.settings.replacements[pattern];
            await this.plugin.saveSettings();
            this.display();
          }));
    }

    let newPatternComponent, newReplacementComponent;

    new Setting(containerEl)
      .setName('Nuevo patrón')
      .setDesc('Introduce el patrón que deseas reemplazar (ej: ->)')
      .addText(text => {
        newPatternComponent = text;
        text.setPlaceholder("Introduce el nuevo patrón");
      });

    new Setting(containerEl)
      .setName('Nuevo símbolo')
      .setDesc('Introduce el símbolo con el que se va a reemplazar (ej: →)')
      .addText(text => {
        newReplacementComponent = text;
        text.setPlaceholder("Introduce el nuevo símbolo");
      });

    new Setting(containerEl)
      .addButton(button => {
        button.setButtonText('Añadir nuevo')
          .onClick(async () => {
            const newPattern = newPatternComponent.getValue().trim();
            const newReplacement = newReplacementComponent.getValue().trim();

            if (!newPattern || newPattern === "") {
              new Notice("El patrón no puede estar vacío.");
              return;
            }
            if (this.plugin.settings.replacements[newPattern]) {
              new Notice("Este patrón ya existe.");
              return;
            }

            if (newReplacement && newReplacement !== "") {
              this.plugin.settings.replacements[newPattern] = newReplacement;
              await this.plugin.saveSettings();
              newPatternComponent.setValue("");
              newReplacementComponent.setValue("");
              this.display();
            } else {
              new Notice("El símbolo no puede estar vacío.");
            }
          });
      });
  }
}
