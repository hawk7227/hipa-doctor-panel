/*
 * PhiMailConnector module for phiMail Server
 * 
 * This sample module implements the phiMail Server Integration API calls to allow
 * client software to send an receive messages and status information over
 * an encrypted connection to the phiMail Server.
 *
 * EMR Direct Data Exchange Protocol API Version Implemented: v1.3.1
 *
 * Version 0.97.101b
 * 
 * (c) 2013-2017 EMR Direct. All Rights Reserved.
 * Use of this code is subject to the terms of the phiMail Developer
 * License Agreement ("DLA"). This code may not be used, redistributed or
 * modified without the express written consent of EMR Direct, except as
 * permited by the DLA
 *
 * @module phimail
 */
var tls = require('tls')
var fs = require('fs')

function SendResult(r,s,m) {
  this.recipient = r
  this.succeeded = s
  if (s) {
    this.messageId = m
    this.errorText = null
  } else {
    this.messageId = null
    this.errorText = m
  }
}

function CheckResult() {
  var self = this
  this.isMail = function() {
    return self.mail
  }
  this.isStatus = function() {
    return !self.mail
  }
}

CheckResult.newStatus = function(id, status, info) {
  var instance = new CheckResult()
  instance.mail = false
  instance.messageId = id
  instance.statusCode = status
  instance.info = info
  instance.recipient = null
  instance.sender = null
  instance.numAttachments = 0
  return instance
}

CheckResult.newMail = function(r, s, numAttach, id) {
  var instance = new CheckResult()
  instance.mail = true
  instance.messageId = id
  instance.statusCode = null
  instance.info = null
  instance.recipient = r
  instance.sender = s
  instance.numAttachments = numAttach
  return instance
}
  
function ShowResult(p, h, f, m, l, d, ai) {
  this.partNum = p
  this.headers = h
  this.filename = f
  this.mimeType = m
  this.length = l
  this.data = d
  this.attachmentInfo = ai
}

function AttachmentInfo(filename, mimeType, description) {
  this.filename = filename
  this.mimeType = mimeType
  this.description = description
}

// These options are used for all new connections
function pmc_base() {}

pmc_base.options = {
  // we'll handle authorization in secure connect callback
  rejectUnauthorized: false
}

pmc_base.setServerCertificate = function(filename) {
  pmc_base.options.ca = [ fs.readFileSync(filename) ]
}

pmc_base.setClientCertificate = function(filename, pass) {
  pmc_base.options.cert = fs.readFileSync(filename)
  pmc_base.options.key = pmc_base.options.cert
  pmc_base.options.passphrase = pass
}

/**
 * Open a new connection to the phiMail server.
 * @param {string} host hostname
 * @param {int} port
 */
var PhiMailConnector = function(host, port, cb) {

  var self = this
  var pmcBuffer = new Buffer(0)
  var connected = false
  var lastError = new Error('Not connected')

  this.socket = tls.connect(port, host, pmc_base.options, afterConnection)

  function afterConnection() {
    self.socket.removeListener('close', closeListener)
    if (!self.socket.authorized) {
      var ae = self.socket.authorizationError
      if (ae === 'SELF_SIGNED_CERT_IN_CHAIN') {
        ae = ae + '; this usually means the server trust anchor'
          + ' has not been loaded correctly for the server ' + host
      } 
      return cb(new Error('Server not authorized: ' + ae))
    }
    connected = true;
    self.socket.setTimeout(PhiMailConnector.PHIMAIL_READ_TIMEOUT)
    simpleCommand('INFO VER NODE.JS ' + PhiMailConnector.VERSION
      + '.' + PhiMailConnector.BUILD, 'Info command failed: ', cb)
  }
  
  // initial close listener until securely connected
  this.socket.on('close', closeListener)

  function closeListener(had_error) {
    cb(lastError)
  }

  this.socket.on('error', 
    function errorListener(err) {
      connected = false
      lastError = err
    })

  this.socket.setTimeout(PhiMailConnector.PHIMAIL_CONNECT_TIMEOUT,
    timeoutListener)

  function timeoutListener() {
    if (connected) {
      self.socket.end()
      connected = false
      lastError = new Error('Read timed out') 
   } else {
      lastError = new Error('Connection timed out')
   }
   self.socket.destroy()
  }

  this.socket.on('end',
    function endListener() {
      connected = false
      lastError = new Error('Server closed connection')
    })
  
 
  /** Close the socket connection to the server. */
  this.close = function(cb) {
    connected = false
    self.socket.end()
    lastError = new Error('Connection previously closed')
    cb()
  }

  function sendCommand(command, cb) {
    //check for illegal chars
    if (!connected) return cb(lastError)
    self.socket.write(command, 'utf8')
    self.socket.write('\n', 'utf8',
     function() { 
       readLine(cb) 
     })
  }

  function readLinesIntoArray(terminator, num, cb) {
    var line_array = []
    function rlia_worker(err,line) {
      if (err) return cb(err)
      if (terminator !== null && line === terminator) return cb(null,line_array)
      line_array.push(line)
      if (num > 0 && line_array.length === num) return cb(null,line_array)
      readLine(rlia_worker)
    }
    readLine(rlia_worker)
  }

  function buffer_read_worker() {
    var bufferArray = [pmcBuffer]
    var chunk
    while (null !== (chunk = self.socket.read())) {
      bufferArray.push(chunk)
    }
    pmcBuffer = (bufferArray.length === 1 ? pmcBuffer : Buffer.concat(bufferArray))
  }

  function readLine(cb) {
    function readLine_check_ready(calledByWorker) {
      var index = pmcBuffer.indexOf('\n')
      if (index > -1) {
         var line = pmcBuffer.toString('utf8', 0, index)
         pmcBuffer = pmcBuffer.slice(index + 1)
         if (pmcBuffer.length === 0) pmcBuffer = new Buffer(0)
         if (calledByWorker) { 
           self.socket.removeListener('readable', readLine_worker)
           self.socket.removeListener('timeout', readLine_fail)
         }
         return cb(null, line)
      }
      if (!connected) return cb(lastError) 
      if (!calledByWorker) {
        self.socket.on('readable', readLine_worker)
        self.socket.on('timeout', readLine_fail)
      }
    }

    function readLine_worker() {
      buffer_read_worker()
      readLine_check_ready(true)
    }

    function readLine_fail() {
       self.socket.removeListener('readable', readLine_worker)
       self.socket.removeListener('timeout', readLine_fail)
       return cb(lastError)
    }

    readLine_check_ready(false)

  }

  function readIntoBuffer(length, cb) {
    function rib_check_ready(calledByWorker) {
      if (pmcBuffer.length >= length) {
        var buf = pmcBuffer.slice(0,length)
        pmcBuffer = pmcBuffer.slice(length + 1)
        if (pmcBuffer.length === 0) pmcBuffer = new Buffer(0)
        if (calledByWorker) {
          self.socket.removeListener('readable', rib_worker)
          self.socket.removeListener('timeout', rib_fail)
        }
        return cb(null, buf)
      }
      if (!connected) return cb(lastError)
      if (!calledByWorker) {
        self.socket.on('readable', rib_worker)
        self.socket.on('timeout', rib_fail)
      }
    }

    function rib_worker() {
      buffer_read_worker()
      rib_check_ready(true)
    }

    function rib_fail() {
       self.socket.removeListener('readable', rib_worker)
       self.socket.removeListener('timeout', rib_fail)
       return cb(lastError)
    }

    rib_check_ready(false) 
  }

  function simpleCommand(command, errorMessage, cb) {
     sendCommand(command,
        function(err, response) { 
          if (err) return cb(err)
          if (response !== 'OK') return cb(new Error(errorMessage + response))
	  cb()
        });
  }

  /** 
   * Authenticate user.
   * @param {string} user username
   * @param {string} pass password (optional)
   */
  this.authenticateUser = function(user, pass, cb) {
    if (typeof cb === 'undefined') {
      cb = pass
      pass = null
    }
    simpleCommand('AUTH ' + user + extraParam(pass), 
      'Authentication failed: ', cb)
  }

  /**
   * Change password for the currently authenticated user.
   * @param {string} pass new password
   */
  this.changePassword = function(pass, cb) {
    simpleCommand('PASS ' + pass, 'Password change failed: ', cb)
  }

  /**
   * Add a recipient to the current outgoing message.
   * @param {string} recipient Direct address of recipient 
   */
  this.addRecipient = function(recipient, cb) {
    simpleCommand('TO ' + recipient, 'Add recipient failed: ',
      function(err) { 
        if (err) return cb(err)
        readLine(cb)  //get recipient info
      }) 
  }

  /**
   * Add a CC recipient to the current outgoing message.
   * @param {string} recipient Direct address of CC recipient 
   */
  this.addCCRecipient = function(recipient, cb) {
    simpleCommand('CC ' + recipient, 'Add CC recipient failed: ',
      function(err) { 
        if (err) return cb(err)
        readLine(cb)  //get recipient info
      }); 
  }

  /** Clear the current outgoing message. */
  this.clear = function(cb) {
     simpleCommand('CLEAR', 'Clear failed: ', cb)
  }

  /** Logout currently authenticated user but keep connection open.*/
  this.logout = function(cb) {
     simpleCommand('LOGOUT', 'Logout failed: ', cb)
  }

  function addData(dataBytes, dataType, filename, encoding, cb) {
    // handle missing optional filename parameter
    if (typeof cb === 'undefined') {
      cb = filename
      filename = null
    }
    //confirm encoding first
    sendCommand(dataType + ' ' + dataBytes.length + extraParam(filename),
      function(err, response) { 
        if (err) return cb(err)
        if (response !== 'BEGIN') {
          return cb(new Error('Add ' + dataType + ' failed: ' + response))
        }
        self.socket.write(dataBytes, encoding, function() {
          readLine(function(err, response) {
            if (err) return cb(err)
            if (response !== 'OK') {
              return cb(new Error('Add '+ dataType + ' failed:' + extraParam(response)))
            }
            cb()
          })
        })
      })
  }

  /**
   * Add preformed MIME content to the current outgoing message.
   * @param {string} data preformed 7bit US-ASCII MIME content
   */
  this.addMIME = function(data, cb) {
    addData(data, 'ADD MIME', null, 'US-ASCII', cb)
  }

  /**
   * Add a CDA part to the current outgoing message.
   * @param {string} data UTF8 XML content
   * @param {string} filename name to associate with attachment (optional)
   */
  this.addCDA = function(data, filename, cb) {
    addData(data, 'ADD CDA', filename, 'UTF-8', cb)
  }

  /**
   * Add an XML document to the current outgoing message.
   * @param {string} data UTF8 XML content
   * @param {string} filename name to associate with attachment (optional)
   */
  this.addXML = function(data, filename, cb) {
    addData(data, 'ADD CDA', filename, 'UTF-8', cb)
  }

  /**
   * Add a text part to the current outgoing message.
   * @param {string} data UTF8 text content
   * @param {string} filename name to associate with attachment (optional)
   */
  this.addText = function(data, filename, cb) {
    addData(data, 'ADD TEXT', filename, 'UTF-8', cb)
  }

  /**
   * Add a binary (raw) data part to the current outgoing message.
   * @param {Buffer} data binary content
   * @param {string} filename name to associate with attachment (optional)
   */
  this.addRaw = function(data, filename, cb) {
    addData(data, 'ADD RAW', filename, null, cb)
  }

  /** 
   * Set (or unset) Subject header on current outgoing message.
   * @param {string|null} data subject 
   */
  this.setSubject = function(data, cb) {
     simpleCommand('SUBJECT' + extraParam(data), 'Set subject failed: ', cb)
  }

  /** 
   * Set Final Delivery Notification for the current outgoing message.
   * @param {boolean} value 
   */
  this.setDeliveryNotification = function(value, cb) {
     simpleCommand('SET FINAL ' + (value ? '1' : '0'),
       'Set delivery notification failed: ', cb)
  }


  /** 
   * Send the current outgoing message.
   * @param {function} cb callback(Error,SendResult[]) 
   */
  this.send = function(cb) {
    sendCommand('SEND',
      function(err, response) {
        if (err) return cb(err)
        if (response.substring(0, 4) === 'FAIL') {
          cb(new Error('Send failed: ' + response))
        }

        var output = []

        function send_rec(response) {
	  if (response !== null && response !== 'OK') {
	    var rExplode = split(response.trim(), ' ', 3)
	    switch (rExplode[0]) {
	      case 'ERROR':
		output.push(new SendResult(rExplode[1], false, rExplode[2]))
		break
	      case 'QUEUED':
		output.push(new SendResult(rExplode[1], true, rExplode[2]))
		break
	      default: 
		return cb(new Error('Send failed with unexpected response ' + response))
	    }
	    return sendCommand('OK',
	      function(err, response) {
		if (err) return cb(err)
		send_rec(response, cb)
	      })
	  }
	  sendCommand('OK',
	    function(err, response) {
	      if (err) return cb(err)
	      cb(null, output)
	    })
	  } 
        send_rec(response)
      })
  }

  /** 
   * Check message queue for new status notification or incoming mail message.
   * @param {function} cb callback(Error,CheckResult|null) 
   */
  this.check = function(cb) {
    sendCommand('CHECK',
      function(err, response) {
        if (err) return cb(err)
        if (response === 'NONE') return cb()
        if (response.substring(0, 4) === 'FAIL') {
          return cb(new Error('Check failed: ' + response))
        }
        if (response.substring(0, 6) === 'STATUS') {
          var rExplode = split(response.trim(), ' ', 4)
          return cb(null, CheckResult.newStatus(rExplode[1], rExplode[2],
              rExplode[3]))
        } else if (response.substring(0, 4) === 'MAIL') {
          var rExplode = split(response.trim(), ' ', 5)
          var numAttach = parseInt(rExplode[3])
          return cb(null, CheckResult.newMail(rExplode[1], rExplode[2],
              numAttach, rExplode[4]))
        } else {
          return cb(new Error('Check failed with unexpected response: ' + response))
        }
      })
  }

  /** Acknowledge current status notification to remove from queue. */
  this.acknowledgeStatus = function(cb) {
     simpleCommand('OK', 'Status acknowledgement failed: ', cb)
  }

  /** Acknowledge current incoming mail message to remove from queue. */
  this.acknowledgeMessage = function(cb) {
     simpleCommand('DONE', 'Message acknowledgement failed: ', cb)
  }

  /** Alias for acknowledgeMessage. */
  this.done = function(cb) {
     acknowledgeMessage(cb)
  }

  /**
   * Retrieve a content part from the current incoming message.
   * @param {int} messagePart part number to retrieve
   * @param {function} cb callback(Error,ShowResult|null)
   */
  this.show = function(messagePart, cb) {

    var headers = []
    var filename = null 
    var mimeType
    var length
    var buf
    var ai = []
    var numAttach

    simpleCommand('SHOW ' + messagePart,
      'Show ' + messagePart + ' failed: ', getShowData1)

    function getShowData1(err) { 
      if (err) return cb(err)
      readLinesIntoArray('', messagePart === 0 ? 0 : 1, getShowData2) 
    }

    function getShowData2(err,line_array) {
      if (err) return cb(err)
      if (messagePart === 0) headers = line_array
      else filename = line_array[0]
      readLinesIntoArray(null, 2, getShowData3)
    }

    function getShowData3(err, line_array2) {
      if (err) return cb(err)
      mimeType = line_array2[0]
      length = parseInt(line_array2[1])
      readIntoBuffer(length, getShowData4)
    }

    function getShowData4(err, buf_read) {
      if (err) return cb(err)
      buf = buf_read
      if (messagePart === 0) {
	//need to get attachment info
	readLine(getAttInfoArray)
      } else {
	return show_finish()
      }
    }

    function getAttInfoArray(err, line) {
      if (err) return cb(err)
      numAttach = parseInt(line)
      if (numAttach === 0) return show_finish()
      readLinesIntoArray(null, numAttach * 3,
	function(err, a_array) {
	  if (err) return cb(err)
	  for (n = 0; n < numAttach; n++) {
	    aFileName = a_array[n * 3]
	    aMimeType = a_array[n * 3 + 1]
	    aDescription = a_array[n * 3 + 2]
	    ai.push(new AttachmentInfo(
	      aFileName, aMimeType, aDescription))
	  }
	  return show_finish()
	})
    }

    function show_finish() {
      return cb(null, new ShowResult(
	messagePart, headers, filename, mimeType,
	length, buf, ai))
    }
  }

  /**
   * Search the directory.
   * @param {string} searchFilter search criteria
   * @param {function} cb callback(Error,string[]|null)
   */
  this.searchDirectory = function(searchFilter, cb) {
    simpleCommand('LOOKUP JSON ' + searchFilter,
      'Directory search failed: ', getNumResults)

    function getNumResults(err) { 
      if (err) return cb(err);
      readLine(getResultsArray)
    }

    function getResultsArray(err, line) {
      if (err) return cb(err)
      numResults = parseInt(line)
      if (numResults === 0) return cb(null, [])
      readLinesIntoArray(null, numResults,
	function(err, s_array) {
	  if (err) return cb(err)
	  return cb(null, s_array)
	})
    }

  }

  function extraParam(s) {
    return (s !== null && s.length > 0 ? ' ' + s : '')
  }

  function split(str, separator, limit) {
    var a = str.split(separator, limit+1);
    if (a.length <= limit) return a;
    a.pop();
    var s = a.join(separator).length;
    a.push(a.pop() + str.substr(s));
    return a;
  }

}

PhiMailConnector.setServerCertificate = function(filename) {
  pmc_base.setServerCertificate(filename)
}

PhiMailConnector.setClientCertificate = function(filename, pass) {
  pmc_base.setClientCertificate(filename, pass)
}

PhiMailConnector.VERSION = '0.97'
PhiMailConnector.BUILD = '101b'
PhiMailConnector.API_VERSION = '1.3.1'
PhiMailConnector.PHIMAIL_READ_TIMEOUT = 120000
PhiMailConnector.PHIMAIL_CONNECT_TIMEOUT = 30000

module.exports = PhiMailConnector
