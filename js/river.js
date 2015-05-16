/// <reference path="../typings/jquery/jquery.d.ts"/>
/*jshint browser: true, noempty: false, jquery: true, unused: false, newcap: false*/
var River = function() {
    var user = new Object;
    var setTitle = function() {};
    var unread = 0;
    var last_unread = null;
    var socket = null;

    var Init = function() {
            $('#main').html('<div id="river"></div>');
            $('#river').html('<div id="menubox"></div>');
            $('#menubox').html('<div id="control-container" class="control-box"><div id="write-control" class="write-button"><a href="#">WRITE</a></div><div id="last-read-control" class="last-read-button"><a href="#">LAST READ</a></div><div id="twitter_signin" class="river-login"><a href="#" onclick="River.OAuth();"><img src="img/sign-in-with-twitter-gray.png" alt="Sign in with Twitter"></a></div></div>');
            $('#river').append('<div id="msgbox"></div>');
            $('#msgbox').addClass('hidden');
            $('#write-control').click(function() {
                $('#msgbox').slideToggle(250);
            });
            $('#last-read-control').click(function() {
                River.Scroll();
            });
            $('#msgbox').html('<div class="msgbox-username">You (@username)</div><fieldset><textarea name="status" id="status" rows="5" cols="40" class="" placeholder="Click here to write your message." autocomplete="off"></textarea><div class="characters">140</div></fieldset><div class="msgbox-sendbutton"><a href="#" onclick="River.Tweet.Send();">SEND</></div>');
            $('#status').on('input', function() {
                var count = 140 - $('#status').val().length;
                $('.characters').html(count.toString());
            });

            $('#river').append('<div id="stream"></div>');

            var maxtweets = localStorage.getItem('warcode.river.user.maxtweets');
            if(!maxtweets) {
                localStorage.setItem('warcode.river.user.maxtweets', 300);
            }

            Title();
            //Test();
            Login();
        },

        Login = function() {
            user.login_token = localStorage.getItem('warcode.river.user.login_token');
            user.hasTwitterAuth = false;
            //console.log(user);

            $.ajax({
                type: "POST",
                url: "https://deny.io/river/login",
                data: {
                    login_token: user.login_token
                },
                dataType: 'json',
                success: function(data, status, jqXHR) {
                    if (jqXHR.status === 201) {
                        localStorage.setItem('warcode.river.user.login_token', data.login_token);
                        user.login_token = data.login_token;
                        user.hasTwitterAuth = data.hasTwitterAuth;
                        if (user.hasTwitterAuth) {
                            $('.river-login').hide();
                            Timeline();
                        }
                        else {
                            Welcome();
                        }
                        //console.log('created new user - token: %s, twitter: %s', data.login_token, data.hasTwitterAuth);
                    } else if (jqXHR.status === 200) {
                        user.hasTwitterAuth = data.hasTwitterAuth;
                        if (user.hasTwitterAuth) {
                            $('.river-login').hide();
                            Timeline();
                        }
                        else {
                            Welcome();
                        }
                        //console.log('existing user - token: %s, twitter: %s', data.login_token, data.hasTwitterAuth);
                    } else {
                        console.log(jqXHR.status);
                    }
                },
                error: function(data, status, jqXHR) {
                    Welcome();
                }
            });
        },
        
        Welcome = function() {
            if(document.getElementById("welcome") === null)
            {
                Tweet.AddWelcome();
            }
        },

        Logout = function() {
            $.ajax({
                type: "POST",
                url: "https://deny.io/river/logout",
                data: {
                    login_token: user.login_token
                },
                dataType: 'json',
                success: function(data, status, jqHXR) {
                    if (socket) {
                        socket.disconnect();
                    }
                }
            });
        },

        OAuth = function() {
            if (user.login_token) {
                window.location = 'https://deny.io/river/oauth/login?login_token=' + user.login_token;
            } else {
                user.login_token = localStorage.getItem('warcode.river.user.login_token');
                window.location = 'https://deny.io/river/oauth/login?login_token=' + user.login_token;
            }
        },

        Timeline = function() {
            if (user.hasTwitterAuth) {

                //console.log('timeline');
                $.ajax({
                    type: "GET",
                    url: "https://deny.io/river/user/timeline",
                    data: {
                        login_token: user.login_token
                    },
                    dataType: 'json',
                    success: function(data, status, jqXHR) {
                        //console.log(data);

                        var data_object;
                        if (typeof data === 'string') {
                            data_object = JSON.parse(data);
                        } else {
                            data_object = data;
                        }

                        if (data_object.errors) {
                            $('#stream').prepend('<div id="stream-start" class="tweet">TWITTER ERROR LOADING TIMELINE.</div>');
                        } else {

                            var length = data_object.length;
                            for (var i = length - 1; i >= 0; i--) {

                                if (data_object[i].retweeted_status) {
                                    Tweet.AddReTweet(data_object[i]);
                                } else {
                                    Tweet.Add(data_object[i]);
                                }
                            }
                        }
                        Connect();
                    }
                });
            }
        },

        Connect = function() {
            if (user.hasTwitterAuth) {
                
                socket = null;
                socket = io.connect('https://deny.io/river/user/stream/socket');

                socket.on('challenge', function(data) {
                    //console.log(data);
                    socket.emit('rise', {
                        socket_id: data.socket_id,
                        login_token: user.login_token
                    });
                });

                socket.on('rise-accepted', function(data) {
                    var keywordtest = localStorage.getItem('warcode.river.user.keyword');
                    if(keywordtest)
                    {
                        StreamByKeyword(keywordtest);
                    }
                    else
                    {
                        Stream();    
                    }
                });

                socket.on('tweet', function(data) {
                    Tweet.Add(data);
                });

                socket.on('retweet', function(data) {
                    Tweet.AddReTweet(data);
                });

                socket.on('delete', function(data) {
                    Tweet.Delete(data.delete.status.id_str);
                });

                socket.on('end', function(data) {
                    $('#stream').prepend('<div id="stream-stop" class="tweet">Stream ended unexpectedly</div>');
                    $('#stream').prepend('<div id="stream-starting" class="tweet">Attempting to reconnect</div>');
                    setTimeout(Connect, 10000);
                });
            }
        },

        Stream = function() {
            if (user.hasTwitterAuth) {
                $.ajax({
                    type: "GET",
                    url: "https://deny.io/river/user/stream",
                    data: {
                        login_token: user.login_token
                    },
                    dataType: 'json',
                    success: function(data, status, jqXHR) {
                        $('#stream').prepend('<div id="stream-start" class="tweet">STREAM STARTED</div>');
                    }
                });
            }
        },

        StreamByKeyword = function(keyword) {
            if (user.hasTwitterAuth) {
                $.ajax({
                    type: "GET",
                    url: "https://deny.io/river/user/streamkeyword",
                    data: {
                        login_token: user.login_token,
                        keyword: keyword
                    },
                    dataType: 'json',
                    success: function(data, status, jqXHR) {
                        $('#stream').prepend('<div id="stream-start" class="tweet">KEYWORD STREAM STARTED</div>');
                    }
                });
            }
        },

        Title = function() {
            $(window).bind("blur", function() {
                $('.last-unread').removeClass('last-unread');
                last_unread = $("#stream .tweet:first");
                last_unread.addClass('last-unread');
                setTitle = function() {
                    unread++;
                    document.title = '(' + unread + ') River';
                };
            });
            $(window).bind("focus", function() {
                unread = 0;
                if (last_unread) {
                    if (last_unread.offset().top > $(window).height()) {
                        $('#last-read-control').show();
                    }
                }
                window.setTimeout(function() {
                    document.title = 'River';
                }, 160);
                setTitle = function() {};
            });
        },

        Scroll = function() {
            if (last_unread) {
                $('html, body').animate({
                    scrollTop: last_unread.offset().top - ($(window).height() / 2)
                }, 1000);
                last_unread = null;
                $('#last-read-control').hide();
            }
        },

        ScrollFixed = function() {
            if ($(window).scrollTop() > 98) {
                $(window).scrollTop($(window).scrollTop() + 98);
            }
        },

        PruneTweets = function() {
            var max = +localStorage.getItem('warcode.river.user.maxtweets')
            if($('.tweet').length > max) { 
                $('#stream .tweet:gt('+max+')').remove();
            }
        },

        FinishExistingAnimations = function() {
            $('.tweet').finish();
        },

        Test = function() {
            Tweet.Add({
                created_at: "Sat Jul 13 19:27:32 +0000 2013",
                id_str: "356132806738444288",
                user: {
                    profile_image_url_https: "https://si0.twimg.com/profile_images/1797302380/gs-logo-green-500x500_normal.jpg",
                    name: "Geek & Sundry",
                    screen_name: "GeekandSundry"
                },
                text: "Love Tokusatsu or want to learn more about it?  Jamie's vlog is for you!  http://t.co/SVWkFRdWsc"
            });
            setTimeout(Test, 1000);
        },

        Tweet = function() {
            var counter = 0;

            var Add = function(data) {
                    FinishExistingAnimations();
                    //console.log('TWEET');
                    //console.log(data);

                    var data_object;
                    if (typeof data === 'string') {
                        data_object = JSON.parse(data);
                    } else {
                        data_object = data;
                    }

                    var twitter_data = data_object;
                    //console.log(data_object[0]);
                    //console.log('Created at: %s',twitter_data.created_at);
                    var isEmbed = false;
                    if (twitter_data.entities.media && twitter_data.entities.media[0]) {
                        //embed image
                        isEmbed = true;
                        $('#stream').prepend('<div id="' + twitter_data.id_str + '" class="tweet hidden"><div id="content" class="content"><img class="avatar" src="' + twitter_data.user.profile_image_url_https + '"><div class="user"> ' + twitter_data.user.name + ' (<a href="https://twitter.com/' + twitter_data.user.screen_name + '" target="_blank">@' + twitter_data.user.screen_name + '</a>)</div><div class="message">' + twttr.txt.autoLink(twitter_data.text, {
                            urlEntities: twitter_data.entities.urls
                        }) + '</div></div><a href="https://twitter.com/' + twitter_data.user.screen_name + '/status/' + twitter_data.id_str + '" target="_blank" class="control open">open</a><a href="https://twitter.com/intent/tweet?in_reply_to=' + twitter_data.id_str + '" class="control reply" target="_blank">reply</a><abbr class="timeago" title="' + moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("ddd MMM DD HH:mm:ss YYYY") + '" data-livestamp="' + moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("X") + '"></abbr><div id="imageEmbedContainer" class="embedContainer"><a target="_blank" href="' + twitter_data.entities.media[0].media_url_https + '"><img src="' + twitter_data.entities.media[0].media_url_https + '" class="embedImage"></a></div></div></div>');

                    } else {
                        isEmbed = false;
                        $('#stream').prepend('<div id="' + twitter_data.id_str + '" class="tweet hidden"><div id="content" class="content"><img class="avatar" src="' + twitter_data.user.profile_image_url_https + '"><div class="user"> ' + twitter_data.user.name + ' (<a href="https://twitter.com/' + twitter_data.user.screen_name + '" target="_blank">@' + twitter_data.user.screen_name + '</a>)</div><div class="message">' + twttr.txt.autoLink(twitter_data.text, {
                            urlEntities: twitter_data.entities.urls
                        }) + '</div></div><a href="https://twitter.com/' + twitter_data.user.screen_name + '/status/' + twitter_data.id_str + '" target="_blank" class="control open">open</a><a href="https://twitter.com/intent/tweet?in_reply_to=' + twitter_data.id_str + '" class="control reply" target="_blank">reply</a><abbr class="timeago" title="' + moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("ddd MMM DD HH:mm:ss YYYY") + '" data-livestamp="' + moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("X") + '"></abbr></div></div>');
                    }

                    //$('#stream').prepend('<div id="'+twitter_data.id_str+'" class="tweet hidden"><div id="content" class="content"><img class="avatar" src="' + twitter_data.user.profile_image_url_https +'"><div class="user"> '+ twitter_data.user.name +' (<a href="https://twitter.com/'+ twitter_data.user.screen_name +'" target="_blank">@'+ twitter_data.user.screen_name +'</a>)</div><div class="message">'+ twttr.txt.autoLink(twitter_data.text, { urlEntities: twitter_data.entities.urls }) +'</div></div><a href="https://twitter.com/'+twitter_data.user.screen_name +'/status/'+ twitter_data.id_str +'" target="_blank" class="control open">open</a><a href="https://twitter.com/intent/tweet?in_reply_to='+ twitter_data.id_str +'" class="control reply">reply</a><abbr class="timeago" title="'+ moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("ddd MMM DD HH:mm:ss YYYY") +'" data-livestamp="'+ moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("X") +'"></abbr></div></div>');
                    AutoSize(twitter_data.id_str, isEmbed);
                    $('#' + twitter_data.id_str).fadeIn();
                    setTitle();
                    ScrollFixed();
                    PruneTweets();
                },

                AddReTweet = function(data) {
                    FinishExistingAnimations();
                    var twitter_data = data;
                    //console.log('RETWEET');
                    //console.log(data);
                    var isEmbed = false;
                    if (twitter_data.retweeted_status.entities.media && twitter_data.retweeted_status.entities.media[0]) {
                        //
                        isEmbed = true;
                        $('#stream').prepend('<div id="' + twitter_data.retweeted_status.id_str + '" class="tweet retweet hidden"><div class="content"><img class="avatar" src="' + twitter_data.retweeted_status.user.profile_image_url_https + '"><img class="retweeter" src="' + twitter_data.user.profile_image_url_https + '"><div class="user-retweet"><img src="img/retweet.png"> ' + twitter_data.retweeted_status.user.name + ' (<a href="https://twitter.com/' + twitter_data.retweeted_status.user.screen_name + '" target="_blank">@' + twitter_data.retweeted_status.user.screen_name + '</a>) by <a href="https://twitter.com/' + twitter_data.user.screen_name + '" target="_blank">@' + twitter_data.user.screen_name + '</a></div><div class="message">' + twttr.txt.autoLink(twitter_data.retweeted_status.text, {
                            urlEntities: twitter_data.retweeted_status.entities.urls
                        }) + '</div></div><a href="https://twitter.com/' + twitter_data.user.screen_name + '/status/' + twitter_data.id_str + '" target="_blank" class="control open">open</a><a href="https://twitter.com/intent/tweet?in_reply_to=' + twitter_data.id_str + '" class="control reply" target="_blank">reply</a><abbr class="timeago" title="' + moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("ddd MMM DD HH:mm:ss YYYY") + '" data-livestamp="' + moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("X") + '"></abbr><div id="imageEmbedContainer" class="embedContainer"><a target="_blank" href="' + twitter_data.retweeted_status.entities.media[0].media_url_https + '"><img src="' + twitter_data.retweeted_status.entities.media[0].media_url_https + '" class="embedImage"></a></div></div>');

                    } else {
                        //
                        isEmbed = false;
                        $('#stream').prepend('<div id="' + twitter_data.retweeted_status.id_str + '" class="tweet retweet hidden"><div class="content"><img class="avatar" src="' + twitter_data.retweeted_status.user.profile_image_url_https + '"><img class="retweeter" src="' + twitter_data.user.profile_image_url_https + '"><div class="user-retweet"><img src="img/retweet.png"> ' + twitter_data.retweeted_status.user.name + ' (<a href="https://twitter.com/' + twitter_data.retweeted_status.user.screen_name + '" target="_blank">@' + twitter_data.retweeted_status.user.screen_name + '</a>) by <a href="https://twitter.com/' + twitter_data.user.screen_name + '" target="_blank">@' + twitter_data.user.screen_name + '</a></div><div class="message">' + twttr.txt.autoLink(twitter_data.retweeted_status.text, {
                            urlEntities: twitter_data.retweeted_status.entities.urls
                        }) + '</div></div><a href="https://twitter.com/' + twitter_data.user.screen_name + '/status/' + twitter_data.id_str + '" target="_blank" class="control open">open</a><a href="https://twitter.com/intent/tweet?in_reply_to=' + twitter_data.id_str + '" class="control reply" target="_blank">reply</a><abbr class="timeago" title="' + moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("ddd MMM DD HH:mm:ss YYYY") + '" data-livestamp="' + moment(twitter_data.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY").format("X") + '"></abbr></div>');

                    }

                    AutoSize(twitter_data.retweeted_status.id_str, isEmbed);
                    $('#' + twitter_data.retweeted_status.id_str).fadeIn();
                    setTitle();
                    ScrollFixed();
                    PruneTweets();
                },
                
                AddWelcome = function () {
                    var date = new Date();
                    $('#stream').prepend('<div id="welcome" class="tweet hidden"><div id="content" class="content"><img class="avatar" src="/img/emi.png"><div class="user"> EMI (<a href="https://twitter.com/emiishuman" target="_blank">@emiishuman</a>)</div>'
                    +'<div class="message">Hi! This is river, a streaming twitter client. Click here for more information.</div></div><abbr class="timeago" title="' + moment(date).format("ddd MMM DD HH:mm:ss YYYY") 
                    + '" data-livestamp="' + moment(date).format("X") + '"></abbr></div></div>');
                    AutoSize('welcome', false);
                    $('div#welcome').fadeIn();
                    setTitle();
                    ScrollFixed();
                    PruneTweets();
                },

                AutoSize = function(tweet_id_str, imageEmbed) {
                    var height = $('div#' + tweet_id_str).children('#content').children('.message').height();

                    //Firefox Workaround
                    if (height <= 0) {
                        var ghostElement = $('div#' + tweet_id_str).children('#content').children('.message').clone().attr("id", false).css({
                            visibility: "hidden",
                            display: "block",
                            position: "absolute"
                        });
                        $("body").append(ghostElement);
                        height = ghostElement.height();
                        ghostElement.remove();
                    }

                    if (height > 44) {
                        $('div#' + tweet_id_str).css("height", 96 + (height - 44));
                        $('div#' + tweet_id_str).css("min-height", 96 + (height - 44));
                    }

                    if (imageEmbed) {
                        $('div#' + tweet_id_str).css("min-height", 370);

                        $('div#' + tweet_id_str).children('div#imageEmbedContainer').children('a').children('img').imagesLoaded(function() {
                            $('div#' + tweet_id_str).children('div#imageEmbedContainer').children('a').children('img').css('margin-top', -(($('div#' + tweet_id_str).children('div#imageEmbedContainer').children('a').children('img').height() - 253) / 2));
                        });

                    }
                },

                Delete = function(id) {
                    $('#' + id).children('#content').children('.message').addClass('deleted');
                },

                Send = function() {
                    $.ajax({
                        type: "POST",
                        url: "https://deny.io/river/user/tweet",
                        data: {
                            login_token: user.login_token,
                            message: $("textarea#status").val()
                        },
                        dataType: 'json',
                        success: function(data, status, jqHXR) {
                            $("textarea#status").val('');
                            $('#msgbox').slideToggle(250);
                            /*
                    if(jqXHR.status === 201) {
                        //Tweeted that fine message
                    } else {
                        $('#stream').prepend('<div id="stream-start" class="tweet">Could not send tweet. Twitter\'s fault.</div>');
                    }
                    */
                        }
                    });
                };

            return {
                Add: Add,
                AddReTweet: AddReTweet,
                AddWelcome: AddWelcome,
                Delete: Delete,
                Send: Send
            };
        }();

    return {
        Init: Init,
        Tweet: Tweet,
        Login: Login,
        OAuth: OAuth,
        Timeline: Timeline,
        Connect: Connect,
        Stream: Stream,
        Scroll: Scroll,
        Logout: Logout
    };
}();