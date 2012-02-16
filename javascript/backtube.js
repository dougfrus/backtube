  window.Backtube = window.Backtube || {};

  ///////////////////////////////
  // Router
  ///////////////////////////////
  Backtube.Router = Backbone.Router.extend({
    routes: {
      "" : "homeRoute",
      "comedy": "comedyHandler"
    },

    homeRoute: function(){
       
    },

    comedyHandler: function(){
      alert("I am now watching a comedy!");
    }

  });

  ///////////////////////////////
  // Models
  ///////////////////////////////
  Backtube.Movie = Backbone.Model.extend({});

  Backtube.MovieList = Backbone.Collection.extend({
    model: Backtube.Movie,
    url: "http://gdata.youtube.com/feeds/api/charts/movies/most_popular?v=2&alt=jsonc&region=US&paid-content=false&callback=?",

    parse: function(response){
      this.totalItems = response.data.totalItems;
      this.startIndex = response.data.startIndex;
      this.itemsPerPage = response.data.itemsPerPage;
      return response.data.items;
    },

    next: function(append){
      var nextStartIndex = 1;//this.startIndex + this.itemsPerPage;
      if(nextStartIndex > this.totalItems){
        // ???
        //TODO: do nothing until I can think of something more clever
      }else{
        this.fetch({data:{"start-index":nextStartIndex},add:append});
      }
      return this;
    },

    previous: function(append){
      var nextStartIndex = this.startIndex - this.itemsPerPage;
      if(nextStartIndex < 0){
        nextStartIndex = 1;
      }

      this.fetch({data:{"start-index":nextStartIndex}, add:append});
      return this;
    },

    jumpTo: function(startIndex) {
      this.fetch({data:{"start-index":startIndex}});
    },
    
    updateCache: function(startIndex, endIndex){
        this.fetch({data:{"start-index":startIndex,"max-results":(endIndex - startIndex)}, add:true});
    },
    
    getLastIndex: function(){
        var lastIndex = this.startIndex + this.itemsPerPage - 1;
        if(lastIndex > this.totalItems){
            lastIndex = this.totalItems;
        }
        return lastIndex;
    }

  });

  Backtube.MovieListViewHelper = Backbone.Model.extend({
    defaults: {
      "view" : "grid",
      "views": {"list": "#movieListTemplate",
                "grid": "#movieGridTemplate",
                "text": "#movieTextOnlyTemplate"}

    },

    getTemplate: function(){
      var vs = this.get("views");
      var v = this.get("view");
      return vs[v];
    },

    toggle: function(){
      this.set("view", this.getNextLabel());
    },

    getNextLabel: function(){
      var keys = _.keys(this.get("views"));
      var nextIndex = _.indexOf(keys, this.get("view")) + 1;
      if(nextIndex >= keys.length){
        nextIndex = 0;
      }
      return keys[nextIndex];
    }

  });



  ///////////////////////////////
  // Views
  ///////////////////////////////
  Backtube.MovieView = Backbone.View.extend({
    tagName: "li",

    initialize: function(){
      //set up a default template
      this.template = this.options.template || "#movieGridTemplate";
    },
          
    events:{
      "click": "clickHandler"
    },
    
    clickHandler: function(e){
        e.preventDefault();
        var elem = e.currentTarget;
        this.index = $(elem).index();
        this.trigger("movieItem:clicked", this.index)
    },

    render: function(){
//      $(this.el).append(this.model.get("title"));
//      var template = _.template($("#movieListTemplate").html());
      var template = _.template($(this.template).html());
      $(this.el).append(template(this.model.toJSON()));
      return this;
    }
  });

  Backtube.MovieListView = Backbone.View.extend({
    el: "#movieList",

    initialize: function(){
      this.model = new Backtube.MovieListViewHelper();

      //NOTE: without bindAll, this.el is undefined in addOne
      _.bindAll(this);
      this.model.on("change:view", this.addAll, this);
      this.collection.on("reset", this.addAll, this);
      this.collection.on("add", this.addAll, this);
      this.currDataIndex = 0;
      this.cacheDataSize= 10;
      this.collection.fetch();
    },

    addOne: function(movie){
      var movieView = new Backtube.MovieView({model:movie, template:this.model.getTemplate()});
      movieView.on("movieItem:clicked", this.updateIndex, this);
      $(this.el).append(movieView.render().el);
      return this;
    },

    addAll: function(){
      $(this.el).html("");
      this.collection.each(this.addOne);
      return this;
    },
    
    updateIndex: function(e){
        this.currDataIndex = e;
        var lastCacheElem = this.currDataIndex + this.cacheDataSize;
        var collectionLastDataIndex = this.collection.getLastIndex();
        if(lastCacheElem > collectionLastDataIndex){
            this.collection.updateCache(collectionLastDataIndex + 1, lastCacheElem + 5);
        }
    }
  });


  Backtube.SidebarView = Backbone.View.extend({
    el: "#sidebar",
    initialize: function(){
      _.bindAll(this);
      this.viewToggleButton = new Backtube.ViewToggleButton({model:this.options.viewToggle});
      this.pagination = new Backtube.Pagination({collection: this.options.movieList});
      this.appendButton =  new Backtube.Button({collection:this.options.movieList,
                              label:"Append",
                              clickHandler : function(){
                                this.collection.next(true);
                                this.render();
                              } });
      this.render();
    },
    render: function(){
      $(this.el).html("");
      $(this.el).append(this.viewToggleButton.el);
      $(this.el).append(this.pagination.el);
      $(this.el).append(this.appendButton.el);

    }
  });

  Backtube.ViewToggleButton = Backbone.View.extend({
    tagName: "button",
    className: "toggleButton",
    initialize: function(){
      _.bindAll(this);
      this.render();
    },
    render: function(){
      $(this.el).html(this.model.getNextLabel() + " view");
      return this;
    },
    events:{
      "click": "toggle"
    },
    toggle: function(){
      this.model.toggle();
      this.render();
    }
  });

  Backtube.Button = Backbone.View.extend({
    tagName: "button",

    initialize: function(){
      _.bindAll(this);
      this.clickHandler = this.options.clickHandler;
      this.render();
    },
    render: function(){
      $(this.el).html(this.options.label);
      return this;
    },
    events:{
      "click": "clickHandler"
    }
  });

  //TODO hide prev and next when at edges
  Backtube.Pagination = Backbone.View.extend({
    tagName: "div",

    initialize: function(){
      _.bindAll(this);
      this.currentPage = 1;
      this.nextButton = new Backtube.Button({model:this.collection,
                              label:"Next",
                              clickHandler : function(){
                                this.model.next(false);
                                this.render();
                              } });
      this.previousButton = new Backtube.Button({model:this.collection,
                              label:"Prev",
                              clickHandler : function(){
                                this.model.previous(false);
                                this.render();
                              } });
      this.collection.on("reset", this.render, this);
      //this.render();
    },


    events: {
      "click .pageNumber": "jumpTo"
    },

    jumpTo: function(e){
      e.preventDefault();
      this.currentPage = 1 * $(e.currentTarget).html();
      this.collection.jumpTo( (this.currentPage * this.collection.itemsPerPage) - (this.collection.itemsPerPage - 1));
    },
    calcNumOfPages: function(){
      var list = this.collection;
      return Math.ceil(list.totalItems/list.itemsPerPage);
    },


    render: function(){

        // detach existing dom nodes so that we don't lose the event listeners...
        $(this.nextButton.el).detach();
        $(this.previousButton.el).detach();

        // empty kills all event listeners for child nodes
        $(this.el).empty();

        // only show previous if we are not on the first page
        if(this.collection.startIndex == 1){
          $(this.previousButton.el).addClass("hidden");
        }else{
          $(this.previousButton.el).removeClass("hidden");
        }

        // only show next if we are not on the last page
        if( (this.collection.startIndex + this.collection.itemsPerPage) > this.collection.totalItems){
          $(this.nextButton.el).addClass("hidden");
        }else{
          $(this.nextButton.el).removeClass("hidden");
        }

      $(this.el).append(this.previousButton.el);
      for(var i = 0; i < this.calcNumOfPages(); i++){
        $(this.el).append("<a href='#' class='pageNumber'>" + (i+1) + "</a>" );
      }
      $(this.el).append(this.nextButton.el);
      return this;
    }
  });













