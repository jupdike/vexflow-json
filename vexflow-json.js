(function() {

  if (!(Vex && Vex.Flow)) {
    throw "Please be sure vexflow is required before requiring vexflow.json."
  }

  function cloner(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function concat(xs) {
    var ret = [];
    _.each(xs, function (x) { return _.each(x, function(x) { ret.push(x); }); });
    return ret;
  }

  Vex.Flow.JSON = function(data) {
    this.data = data;
    this.stave_offset = 0;
    this.stave_height = 60;
    this.stave_delta = 75;
    this.staves = {};
    this.left_padding = 0;
    this.interpret_data();
  }

  Vex.Flow.JSON.prototype.interpret_data = function() {
    if (this.data instanceof Array) {
      if (this.data[0] instanceof Array) {
        this.notes = this.interpret_notes(this.data);
      } else if (typeof this.data[0] === "string") {
        this.notes = this.interpret_notes([ { keys: this.data } ]);
      }
    } else if (this.data.keys) {
      this.notes = this.interpret_notes([this.data]);
    } else if (this.data.notes) {
      this.notes = this.interpret_notes(this.data.notes);
    } else if (this.data.voices) {
      this.voices = this.interpret_voices(this.data.voices);
    }
  };

  Vex.Flow.JSON.prototype.interpret_notes = function(data) {
    return _(data).map(function(datum) {
      if (typeof datum === "string") {
        if (datum == "|") { return { barnote: true} }
        else {
          return { duration: "q", keys: this.interpret_keys([datum]) };
        }
      } else if (datum instanceof Array) {
        return { duration: "q", keys: this.interpret_keys(datum) };
      } else {
        if (datum.keys) {
          datum.keys = this.interpret_keys(datum.keys);
          datum.duration || (datum.duration = "q");
        }
        return datum;
      }
    }, this);
  };
  
  Vex.Flow.JSON.prototype.interpret_voices = function(data) {
    return _(data).map(function(datum) {
      return {
        time: datum.time,
        notes: this.interpret_notes(datum.notes)
      }
    }, this);
  };

  Vex.Flow.JSON.prototype.interpret_keys = function(data) {
    return _(data).map(function(datum) {
      var note_portion, octave_portion, _ref;
      _ref = datum.split("/"), note_portion = _ref[0], octave_portion = _ref[1];
      octave_portion || (octave_portion = "4");
      return "" + note_portion + "/" + octave_portion;
    });
  };

  Vex.Flow.JSON.prototype.draw_canvas = function(canvas, canvas_options) {
    canvas_options = canvas_options || {};
    
    this.canvas = canvas;
    var backend = Vex.Flow.Renderer.Backends.CANVAS;
    if (canvas.tagName.toLowerCase() === "svg") {
      backend = Vex.Flow.Renderer.Backends.SVG;
    }
    this.renderer = new Vex.Flow.Renderer(this.canvas, backend);
    this.context = this.renderer.getContext();
    if (backend === Vex.Flow.Renderer.Backends.SVG) {
      this.context.width = this.canvas.width.baseVal.value|0;
      this.context.height = this.canvas.height.baseVal.value|0;
    }
    
    if (canvas_options.scale) {
      this.context.scale(canvas_options.scale, canvas_options.scale);
    }
  };

  Vex.Flow.JSON.prototype.draw_stave = function(clef, keySignature, options) {
    if (clef == null) clef = "treble";
    if (!(clef instanceof Array)) clef = [clef];
    if (options == null) options = {};

    if (clef.length >= 2) {
        this.left_padding += 10;
    }
    _(clef).each(function(c) {
      this.staves[c] = new Vex.Flow.Stave(10 + this.left_padding, this.stave_offset, this.width - 20);
      this.staves[c].addClef(c).addKeySignature(keySignature).setContext(this.context).draw();
      this.stave_offset += this.stave_delta;
    }, this);
    if (clef.length >= 2 && this.staves.bass && this.staves.treble) {
      var brace = new Vex.Flow.StaveConnector(this.staves.treble, this.staves.bass).setType(3);
      var lineLeft = new Vex.Flow.StaveConnector(this.staves.treble, this.staves.bass).setType(1);
      brace.setContext(this.context).draw();
      lineLeft.setContext(this.context).draw();
      if (options.add_right_double_line) {
        var lineRight = new Vex.Flow.StaveConnector(this.staves.treble, this.staves.bass).setType(6);
        lineRight.setContext(this.context).draw();
      }
    }

  };

  Vex.Flow.JSON.prototype.stave_notes = function(notes) {
    var clefs = _(notes).map(function(note) {
      if (note.clef) {
        return note.clef;
      } else {
        return "treble";
      }
    });
    if (clefs instanceof Array && clefs.length >= 1 && clefs[0] && clefs[0] instanceof Array && clefs[0].length >= 1) {
      clefs = concat(clefs);
    }
    // show be flat list at this point
    clefs = _.uniq(clefs); // only need one of each clef!
    var note_clef_pairs = [];
    _(notes).each(function(note) {
      _.each(clefs, function(clef) { note_clef_pairs.push( [note, clef] ); });
    });

    return _(note_clef_pairs).map(function(note_clef_pair) {
      var note = note_clef_pair[0];
      note.clef = note_clef_pair[1];
      if (note.barnote) { return new Vex.Flow.BarNote(); }
      
      var stave_note;
      note = cloner(note);
      
      note.keys = _.filter(note.keys, function (key) {
        var octave = key.split("/")[1];
        if (note.clef == 'treble') return octave > 3;
        return octave <= 3; // bass
      });
      
      console.log(note.clef);
      console.log(note.keys);

      note.duration || (note.duration = "h");
      //note.clef = "treble"; // here
      stave_note = new Vex.Flow.StaveNote(note);

      _(note.keys).each(function(key, i) {
        var accidental, note_portion;
        note_portion = key.split("/")[0];
        accidental = note_portion.slice(1, (note_portion.length + 1) || 9e9);

        if (accidental.length > 0) {
          stave_note.addAccidental(i, new Vex.Flow.Accidental(accidental));
        }
      });
      return stave_note;
    });
  };
  
  Vex.Flow.JSON.prototype.draw_notes = function(notes) {
    Vex.Flow.Formatter.FormatAndDraw(this.context, this.staves["treble"], notes);
  };
  
  Vex.Flow.JSON.prototype.stave_voices = function(voices) {
    return _(this.voices).map(function(voice) {
      var stave_voice = new Vex.Flow.Voice({
        num_beats: voice.time.split("/")[0],
        beat_value: voice.time.split("/")[1],
        resolution: Vex.Flow.RESOLUTION
      });
      
      stave_voice.setStrict(false);
      stave_voice.addTickables(this.stave_notes(voice.notes));
      return stave_voice;
    }, this);
  };
  
  Vex.Flow.JSON.prototype.draw_voices = function(voices) {
    var formatter = new Vex.Flow.Formatter().joinVoices(voices).format(voices, this.width - 120);
    _(voices).each(function(voice) {
      voice.draw(this.context, this.staves["treble"]);
    }, this);
  };

  Vex.Flow.JSON.prototype.render = function(element, options) {
    options = (options || {});
    this.width = options.width || (element.width|0) || 600; // coerce weird SVG values to ints
    this.height = options.height || (element.height|0) || 120;
    this.clef = options.clef;
    this.scale = options.scale || 1;
    this.keySignature = options.keySignature || 'C';

    this.draw_canvas(element, {
      scale: this.scale
    });
    
    this.draw_stave(this.clef, this.keySignature, options);
    
    if (this.voices) {
      this.draw_voices(this.stave_voices(this.voices));
    } else {
      this.draw_notes(this.stave_notes(this.notes));
    }
  };

}).call(this);
