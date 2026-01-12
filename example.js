/*
 * Example illustrating use of PhiMailConnector class
 *
 * (c) 2013-2016 EMR Direct. All Rights Reserved.
 * Use of this code is subject to the terms of the phiMail Developer
 * License Agreement ("DLA"). This code may not be used, redistributed
 * or modified without the express written consent of EMR Direct, except as
 * permitted by the DLA
 */
var PhiMailConnector = require('phimail-connector'), fs = require('fs')

/**
 *
 * @author EMR Direct
 */

// Specify which parts of the example to run.
// Note: Send and receive examples are grouped here for demonstration
// purposes only. In general, the receive function would run separately 
// on a regular schedule, e.g. once per minute. 
var send = false 
var receive = true

var phiMailServer = 'sandbox.phimail-dev.com'
var phiMailPort = 32541 // this is the default port #

var phiMailUser = 'my-sandbox-address@test.directproject.net'
var phiMailPass = 'my-sandbox-password'

var outboundRecipient = 'somewhere@direct.example.com'
var attachmentSaveDirectory = '/tmp/'

var pc = null

function example() {

  // This command sets the trusted SSL certificate or
  // trust anchor for the phiMail server.
  PhiMailConnector.setServerCertificate('./EMRDirectTestCA.pem')

  // Use the following command to enable client TLS authentication, if
  // required. The key file referenced should contain the following
  // PEM data concatenated into one file:
  //   <your_private_key.pem> encrypted with my_password
  //   <your_client_certificate.pem>
  //   <intermediate_CA_certificate.pem>
  //   <root_CA_certificate.pem>
  //
  //PhiMailConnector.setClientCertificate('./mycert.pem','my_password')

  pc = new PhiMailConnector(phiMailServer, phiMailPort, authenticate)
 
  function authenticate(err) {
    if (err) return close_and_quit(err)
    pc.authenticateUser(phiMailUser,phiMailPass,send_if_requested)
  }

  function send_if_requested(err) {
    if (err) return close_and_quit(err)
    if (send) return pmc_send(receive_if_requested)
    return receive_if_requested()
  }

  function receive_if_requested(err) {
    if (err) return close_and_quit(err)
    if (receive) return pmc_receive(close_and_quit)
    return close_and_quit()
  }

  function close_and_quit(err) {
    if (err) console.log('phiMail ' + err)
    // try to close connection anyway
    pc.close(example_finish)
  }

  function example_finish(err) {
    if (err) console.log('phiMail ' + err)
    console.log('phiMail example finished.')
  }
}

function pmc_send(cb) {
  // Sample code to send a Direct message.

  console.log('Sending a CDA as an attachment')

  // After authentication, the server has a blank outgoing message
  // template. Begin building this message by adding a recipient.
  // Multiple recipients can be added by calling this command more
  // than once. A separate message will be sent for each recipient.
  pc.addRecipient(outboundRecipient,post_add_recipient)

  function post_add_recipient(err, recipientData) {

    // The server returns information about the recipient if the
    // address entered is accepted, otherwise an error is returned.
    // How you use this recipient information is up to you...
    if (err) return cb(err)
    console.log('recipient info: ' + recipientData)

    do_set_subject()
  }

  function do_set_subject() {
    // Optionally, set the Subject of the outgoing message.
    // This will override the default message Subject set by the server.
    pc.setSubject('Test Subject set by Node.js connector',
      do_add_text)
  }

  function do_add_text(err) {
    if (err) return cb(err)

    // Add the main body of the message.
    pc.addText('This is the main message content. A CDA is attached.',
      do_add_cda)
  }

  function do_add_cda(err) {
    if (err) return cb(err)

    // Add A CDA attachment and let phiMail Server assign a filename.
    pc.addCDA(fs.readFileSync('/path/to/outbound_cda.xml'), do_add_raw)
  }

  function do_add_raw(err) {
    if (err) return cb(err)

    // Optionally, add a binary attachment and specify the
    // attachment filename yourself.
    pc.addRaw(fs.readFileSync('/path/to/some/pdf_file.pdf'),'sample.pdf',
      do_set_final_delivery)
  }

  function do_set_final_delivery(err) {
    if (err) return cb(err)
    
    // Optionally, request a final delivery notification message.
    // Note that not all HISPs can provide this notification when requested.
    // If the receiving HISP does not support this feature, the message will
    // result in a failure notification after the timeout period has elapsed.
    // This command will overridea the default setting set by the server.
    //
    pc.setDeliveryNotification(true, do_send)
  }

  function do_send(err) {
    if (err) return cb(err)

    // Send the message. srList will contain one entry for each recipient.
    // If more than one recipient was specified, then each would have an entry.
    pc.send(post_send)
  }

  function post_send(err,srList) {
    if (err) return cb(err)
    srList.forEach(
      function(sr) {
	console.log('Send to ' + sr.recipient
	 + (sr.succeeded ? ' succeeded id=' : ' failed err=')
	 + (sr.succeeded ? sr.messageId : sr.errorText))
      })
    return cb()
  }
}

function pmc_receive(cb) {

  // Sample code to check for any incoming messages. Generally, this
  // code would run in a separate background process to poll the
  // phiMail server at regular intervals for new messages. In production
  // phiMailUser above would be set to an address group to efficiently
  // retrieve messages for all addresses in the address group, rather
  // than iterating through individual addresses.  Please see the
  // API documentation for further information about address groups.

  check_worker()

  function check_worker() {
    console.log('============')
    console.log('Checking mailbox')

    // check next message or status update
    pc.check(process_check_result)
  }

  function process_check_result(err, cr) {
    if (err) return cb(err)

    if (cr == null) {
      console.log('Check returned null; no messages on queue.')
      return cb()
    }
    if (cr.isMail()) {
      // If you are checking messages for an address group,
      // cr.recipient will contain the address in that
      // group to which this message should be delivered.
      console.log('A new message is available for ' + cr.recipient)
      console.log('from ' + cr.sender + '; id '
	+ cr.messageId + '; #att=' + cr.numAttachments)

      var i = 0
      return show_worker()

      function show_worker() {
        // retrieve message part i
	pc.show(i, process_show_result)
      }

      function process_show_result(err, sr) {
	if (err) return cb(err)

	console.log('MimeType = ' + sr.mimeType
	  + '; length=' + sr.length)

	// List all the headers. Headers are set by the
	// sender and may include Subject, Date, additional
	// addresses to which the message was sent, etc.
	// Do NOT use the To: header to determine the address
	// to which this message should be delivered
	// internally; use cr.recipient instead.
        // Note: headers only included for message part 0.
        if (i===0) {
	  sr.headers.forEach(
	   function(header) {
	     console.log('Header: ' + header)
	   });
        }

	// Process the content; for this example text data
	// is echoed to the console and non-text data is
	// written to files.
	if (sr.mimeType.substring(0,5) == 'text/') {
	  // ... do something with text parts ...
	  // For this example we assume ascii or utf8
	  s = sr.data.toString('utf8')
	  console.log('Content:\n' + s + '\n')
	} else {
	  // ... do something with binary data ...
	  console.log('Content: <BINARY> Writing attachment file '
	    + sr.filename)
	  fs.writeFileSync(attachmentSaveDirectory + sr.filename,
	    sr.data)
	}

	// Display the list of attachments and associated info. This info is only
	// included with message part 0.
	if (i===0) {
	  sr.attachmentInfo.forEach(
	    function(ai_entry, k) {
	      console.log('Attachment ' + (k + 1)
		+ ': ' + ai_entry.mimeType
		+ ' fn:' + ai_entry.filename
		+ ' Desc:' + ai_entry.description)
	    })
	}

	if (i === cr.numAttachments) return done_with_this_message()
	else {
	  i++
	  return show_worker()
	}
      }

      function done_with_this_message() {
	// This signals the server that the message can be safely removed from the queue
	// and should only be sent after all required parts of the message have been
	// retrieved and processed
	pc.acknowledgeMessage(continue_check_loop)
      }

    } else {
      // Process a status update for a previously sent message
      console.log('Status Message for ID ' + cr.messageId)
      console.log('  StatusCode = ' + cr.statusCode)
      if (cr.info) console.log('  Info = ' + cr.info)
      if (cr.statusCode === 'failed') {
	// ...do something about a failed message...
	// cr.messageId will match the messageId returned
	// when you originally sent the corresponding message
	// See the API documentation for information about
	// status notification types and their meanings.
      }

      // This signals the server that the status update can be 
      // safely removed from the queue,
      // i.e. it has been successfully received and processed.
      // Note: this is NOT the same method used to acknowledge
      // regular messages
      pc.acknowledgeStatus(continue_check_loop)
    }
  }

  function continue_check_loop(err) {
    if (err) return cb(err)
    // done with this check result, poll for next one...
    check_worker()
  }
}

// Run the example code
example()
